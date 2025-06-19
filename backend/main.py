from fastapi import FastAPI, UploadFile, Form, HTTPException, BackgroundTasks
from starlette.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional, Any
from pydantic import BaseModel
import openai
import os
import json
import time
import threading
import pandas as pd
from pathlib import Path
import pdfplumber
import docx2txt
import re
import sys
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor
import functools
import random
from datetime import datetime

# Global variables
JOBS: Dict[str, Dict] = {}
MAX_CONTEXT_CHARS = 8000  # simple clipping so we don't exceed token limits
CHUNK_SIZE_CHARS = 6000  # size per GPT request
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)  # Ensure the uploads directory exists
TEXT_DIR = BASE_DIR / "text"
TEXT_DIR.mkdir(exist_ok=True, parents=True)  # Ensure the text directory exists
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)  # Ensure the output directory exists

# Initialize OpenAI client
_client = openai.OpenAI(api_key="THE_KEY")

# --- FastAPI app setup ---
app = FastAPI(title="QuestGen Flow Backend", version="0.1.0")

# Allow local dev frontend to call the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, change this!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_excel(job_id: str, questions: List[Dict]) -> None:
    """Generate Excel file from questions"""
    try:
        df = pd.json_normalize(questions)
        excel_path = TEXT_DIR / f"{job_id}.xlsx"
        df.to_excel(excel_path, index=False)
        JOBS[job_id]["excel_file"] = str(excel_path.relative_to(Path(__file__).resolve().parent))
    except Exception as e:
        print(f"Failed to create Excel: {e}")
        JOBS[job_id]["logs"] = ["Failed to create Excel file"]

def _extract_text(file_path: Path) -> str:
    """Extract raw text from PDF or DOCX file."""
    if file_path.suffix.lower() == '.pdf':
        with pdfplumber.open(file_path) as pdf:
            # Skip the first 8 pages, which often contain cover, index, or legal notices
            pages_to_read = pdf.pages[8:] if len(pdf.pages) > 8 else pdf.pages
            # Some pages may not have any extracted text (returns None), so replace with empty string
            text = "\n\n".join((page.extract_text() or "") for page in pages_to_read)
    elif file_path.suffix.lower() == '.docx':
        text = docx2txt.process(file_path)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    return text.strip()

def _split_text(text: str) -> List[str]:
    """Split text into chunks of approximately 2000 characters."""
    # Split by paragraphs
    paragraphs = text.split('\n\n')
    
    # Group paragraphs into chunks
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para_length = len(para)
        if current_length + para_length <= 2000:
            current_chunk.append(para)
            current_length += para_length
        else:
            if current_chunk:
                chunks.append('\n\n'.join(current_chunk))
            current_chunk = [para]
            current_length = para_length
    
    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))
    
    # Limit the number of chunks to reduce token usage
    # Return all chunks so later logic can sample across the document
    return chunks

def _generate_questions(executor: ThreadPoolExecutor, context: str, question_language: str, n_questions: int, start_id: int, job_id: str) -> List[Dict[str, Any]]:
    try:
        # Create prompt
        prompt = f"""You are a knowledgeable teacher preparing an exam ONLY on the information contained in the given book excerpt.  
Your goal is to create exactly {n_questions} high-quality multiple-choice questions that faithfully test a reader’s knowledge of the material — no trivia outside the scope of the book.  
Distribute the questions so they reflect content from the beginning, middle and end of the text. If the total number of questions requested is more than 50, ensure the distribution samples several times across the full text.  

Use the following text as your only source material:
{context}

For each question, provide:
1. Question (in {question_language})
2. 4 options (A, B, C, D) in {question_language}
3. Correct answer (A, B, C, or D)
4. Explanation (in {question_language})
5. Topic (brief)

IMPORTANT RULES:
• Do NOT ask meta-questions about the author (Pearson or anyone else) or structure — only knowledge that would reasonably appear on a test for this book.  
• Keep language clear and precise.  
• Ensure questions are well-distributed over the text section provided.  
• Produce exactly {n_questions} items.

Format the response EXACTLY as this JSON array:
[
  {{
    "question": "Your question in {question_language}",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "correct_answer": "A",
    "explanation": "...",
    "topic": "..."
  }}
]"""


        
        # Generate questions
        chat_resp = _client.chat.completions.create(
            model="gpt-3.5-turbo-0125",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=2000 if n_questions > 5 else 1000,
            timeout=30
        )
        content = chat_resp.choices[0].message.content.strip()
        
        # Parse and validate questions
        try:
            batch_questions = json.loads(content)
            if not isinstance(batch_questions, list):
                raise ValueError("Invalid question format")
            
            valid_questions = []
            for q in batch_questions:
                if isinstance(q, dict) and \
                   'question' in q and 'options' in q and 'correct_answer' in q and 'explanation' in q:
                    # Assign sequential IDs
                    q['id'] = start_id + len(valid_questions)
                    valid_questions.append(q)
            
            if valid_questions:
                JOBS[job_id]["logs"].append(f"Generated {len(valid_questions)} questions")
                return valid_questions
            else:
                return []
        except Exception as e:
            JOBS[job_id]["logs"].append(f"Error parsing questions: {str(e)}")
            return []
            
    except Exception as e:
        JOBS[job_id]["logs"].append(f"Error generating questions: {str(e)}")
        return []

def _translate_explanation(explanation: str, question_language: str, explanation_language: str) -> str:
    try:
        translation_prompt = f"Translate this explanation from {question_language} to {explanation_language}:\n\n{explanation}"
        translation_resp = _client.chat.completions.create(
            model="gpt-3.5-turbo-0125",
            messages=[{"role": "user", "content": translation_prompt}],
            temperature=0.2,
            max_tokens=200,
            timeout=30
        )
        return translation_resp.choices[0].message.content.strip()
    except Exception:
        return explanation

async def _generate_async(job_id: str, raw_text: str, question_language: str, explanation_language: str, n_questions: int, output_format: str):
    def update_job_status(status: str, progress: int, step: int, log_message: str):
        JOBS[job_id]["status"] = status
        JOBS[job_id]["progress"] = progress
        JOBS[job_id]["step"] = step
        JOBS[job_id]["logs"].append(log_message)
        print(f"Job {job_id}: {status} - {progress}% - Step {step} - {log_message}")

    try:
        # Initialize job status
        JOBS[job_id] = {
            "status": "in_progress",
            "progress": 0,
            "step": 1,
            "logs": ["Starting question generation"],
            "questions": [],
            "topics": [],
            "done": False
        }
        update_job_status("in_progress", 0, 1, "Starting question generation")
        
        # Split text into chunks
        chunks = _split_text(raw_text)
        
        # Track all existing question texts to avoid duplicates across batches
        existing_question_texts = set()
        
        update_job_status("in_progress", 5, 1, f"Split text into {len(chunks)} chunks")
        
        # Initialize ThreadPoolExecutor for parallel processing
        with ThreadPoolExecutor(max_workers=5) as executor:
            # Generate questions in parallel
            # Choose representative chunks for initial generation to cover start/middle/end
            if len(chunks) == 0:
                chunks = [raw_text]
            if n_questions <= 20 and len(chunks) >= 3:
                indices = [0, len(chunks) // 2, -1]
            elif n_questions >= 50 and len(chunks) >= 5:
                indices = [0, len(chunks)//4, len(chunks)//2, (3*len(chunks))//4, -1]
            else:
                indices = [0]
            selected_chunks = [chunks[i] for i in indices]

            tasks = [
                asyncio.get_event_loop().run_in_executor(
                    executor,
                    functools.partial(_generate_questions, executor, c, question_language, n_questions, 1, job_id)
                )
                for c in selected_chunks
            ]
            
            update_job_status("in_progress", 20, 1, "Starting generation from first chunk")
            
            generated_questions = await asyncio.gather(*tasks)
            generated_questions = [q for q in generated_questions[0] if q is not None]
            
            update_job_status("in_progress", 40, 1, f"Generated {len(generated_questions)} questions from first chunk")

            # Generate questions in batches until we reach the exact number requested
            current_count = len(generated_questions)
            while current_count < n_questions:
                # Calculate how many more questions we need
                remaining_questions = n_questions - current_count
                batch_size = min(remaining_questions, 5)  # Generate in batches of 5
                
                # Get the next chunk
                chunk = chunks[len(generated_questions) // batch_size % len(chunks)]
                
                update_job_status("in_progress", 45, 2, f"Generating batch of {batch_size} questions")
                
                # Generate questions for this batch
                batch = await asyncio.get_event_loop().run_in_executor(
                    executor,
                    functools.partial(_generate_questions, executor, chunk, question_language, batch_size, current_count + 1, job_id)
                )
                
                # Filter out any None results
                batch = [q for q in batch if q is not None]
                
                # Remove duplicates against all previously kept questions
                unique_batch = []
                similarity_threshold = 0.85  # word–overlap similarity threshold

                def calculate_similarity(q1:str, q2:str)->float:
                    words1 = set(q1.split())
                    words2 = set(q2.split())
                    overlap = words1 & words2
                    return len(overlap) / max(len(words1), len(words2)) if max(len(words1), len(words2)) else 0.0

                for question in batch:
                    qt_lower = question['question'].lower()
                    is_duplicate = False
                    for existing in existing_question_texts:
                        if calculate_similarity(qt_lower, existing) > similarity_threshold:
                            is_duplicate = True
                            break
                    if not is_duplicate:
                        unique_batch.append(question)
                        existing_question_texts.add(qt_lower)
                
                # If we got no unique questions, try again with a different chunk
                if not unique_batch:
                    update_job_status("in_progress", 45, 2, "No unique questions in batch, trying different content")
                    continue
                
                # Add unique questions to our total
                generated_questions.extend(unique_batch)
                current_count += len(unique_batch)
                
                # Update progress
                progress = min(100, int((current_count / n_questions) * 100))
                update_job_status("in_progress", progress, 2, f"Generated {len(unique_batch)} unique questions, total: {current_count}")
                
                # If we have exactly the right number, break
                if current_count == n_questions:
                    break
                
                # If we have too many, remove the extras
                if current_count > n_questions:
                    generated_questions = generated_questions[:n_questions]
                    current_count = n_questions
                    update_job_status("in_progress", 60, 2, f"Adjusted to exact number: {n_questions} questions")
                    break
                
                # If we're not making progress, try a different chunk
                if len(unique_batch) < batch_size / 2:  # If we got less than half the expected questions
                    update_job_status("in_progress", 45, 2, "Low unique questions, trying different content")
                    continue
                

                # If we didn't get enough questions in this batch, keep trying
                if len(batch) < batch_size:
                    update_job_status("in_progress", 50, 2, f"Only got {len(batch)} questions in batch, trying again")
                    continue
                
                # If we have exactly the right number, break
                if current_count == n_questions:
                    break
                
                # If we have too many, remove the extras
                if current_count > n_questions:
                    generated_questions = generated_questions[:n_questions]
                    current_count = n_questions
                    update_job_status("in_progress", 60, 2, f"Adjusted to exact number: {n_questions} questions")
                    break

            # Ensure we have exactly the requested number of questions
            if len(generated_questions) != n_questions:
                raise ValueError(f"Failed to generate exactly {n_questions} questions")

            # Translate explanations in parallel if needed
            if explanation_language.lower() != question_language.lower():
                update_job_status("in_progress", 80, 3, "Starting translation for explanations")
                
                # Translate explanations in parallel
                with ThreadPoolExecutor(max_workers=5) as executor:
                    tasks = [
                        asyncio.get_event_loop().run_in_executor(
                            executor,
                            functools.partial(_translate_explanation, q['explanation'], question_language, explanation_language)
                        )
                        for q in generated_questions
                    ]
                    
                    update_job_status("in_progress", 90, 3, f"Starting translation for {len(tasks)} explanations")
                    
                    translated_explanations = await asyncio.gather(*tasks)
                    
                    # Update questions with translated explanations
                    for q, explanation in zip(generated_questions, translated_explanations):
                        q['explanation'] = explanation
                    
                    update_job_status("in_progress", 95, 3, "Finished translating explanations")

            # Align correct_answer with the content of each explanation
            for q in generated_questions:
                try:
                    explanation_lower = q['explanation'].lower()
                    options = q['options']
                    matched_letter = None
                    # First, check if the explanation explicitly contains the option text
                    for letter, text in options.items():
                        if text.lower() in explanation_lower:
                            matched_letter = letter
                            break
                    # If no option text is found, check for a direct mention of the option letter (A, B, C, D)
                    if not matched_letter:
                        letter_match = re.search(r'\b([ABCD])\b', explanation_lower)
                        if letter_match:
                            matched_letter = letter_match.group(1).upper()
                    # If a match is found and differs from the current correct answer, update it
                    if matched_letter and matched_letter in options and matched_letter != q['correct_answer']:
                        q['correct_answer'] = matched_letter
                except Exception:
                    # If anything fails here, keep the original correct answer
                    continue
            update_job_status("in_progress", 96, 3, "Aligned correct answers with explanations")

            # Ensure diverse distribution of correct answers
            if len(generated_questions) > 1:
                # Get all current correct answers
                current_answers = [q['correct_answer'] for q in generated_questions]
                
                # Calculate answer distribution
                answer_counts = {'A': 0, 'B': 0, 'C': 0, 'D': 0}
                for answer in current_answers:
                    answer_counts[answer] += 1
                
                # If any answer is overrepresented, redistribute
                max_count = max(answer_counts.values())
                if max_count > len(generated_questions) * 0.3:  # If any answer is more than 30% of total
                    # Create a list of all possible answers
                    all_answers = ['A', 'B', 'C', 'D']
                    
                    # Create a weighted list favoring less used answers
                    weighted_answers = []
                    for answer, count in answer_counts.items():
                        # Add more instances of less used answers
                        weighted_answers.extend([answer] * (4 - count))
                    
                    # Shuffle the weighted list
                    random.shuffle(weighted_answers)
                    
                    # Redistribute answers while maintaining validity
                    for i, q in enumerate(generated_questions):
                        # Get current answer and options
                        current_answer = q['correct_answer']
                        options = q['options']
                        
                        # Find a new valid answer
                        new_answer = current_answer
                        attempts = 0
                        max_attempts = 5  # Prevent infinite loops
                        
                        # Try weighted list first
                        while attempts < max_attempts and weighted_answers:
                            try:
                                # Get a new answer from the weighted list
                                new_answer = weighted_answers.pop(0)
                                
                                # Check if the new answer is valid
                                if new_answer != current_answer and new_answer in options:
                                    # Swap the options to maintain validity
                                    temp = options[current_answer]
                                    options[current_answer] = options[new_answer]
                                    options[new_answer] = temp
                                    
                                    q['correct_answer'] = new_answer
                                    break
                            except IndexError:  # If weighted list is empty
                                break
                            
                            attempts += 1
                        
                        # If weighted list failed, try random selection
                        if new_answer == current_answer:
                            for _ in range(max_attempts):
                                # Get a random answer
                                new_answer = random.choice(all_answers)
                                
                                # Check if the new answer is valid
                                if new_answer != current_answer and new_answer in options:
                                    # Swap the options to maintain validity
                                    temp = options[current_answer]
                                    options[current_answer] = options[new_answer]
                                    options[new_answer] = temp
                                    
                                    q['correct_answer'] = new_answer
                                    break
                        
                        # If we still couldn't find a valid swap, keep the original answer
                        if new_answer == current_answer:
                            q['correct_answer'] = current_answer
                            continue
                        


            # Re-index questions to ensure unique sequential IDs
            for idx, q in enumerate(generated_questions, start=1):
                q['id'] = idx

            # Save to Excel if requested
            if output_format == "excel":
                update_job_status("in_progress", 98, 4, "Saving to Excel")
                
                # Create DataFrame
                df = pd.DataFrame([
                    {
                        'ID': q['id'],
                        'Question': q['question'],
                        'Option A': q['options']['A'],
                        'Option B': q['options']['B'],
                        'Option C': q['options']['C'],
                        'Option D': q['options']['D'],
                        'Correct Answer': q['correct_answer'],
                        'Explanation': q['explanation'],
                        'Topic': q['topic']
                    }
                    for q in generated_questions
                ])
                
                # Save to Excel
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"questions_{timestamp}.xlsx"
                df.to_excel(filename, index=False)
                update_job_status("in_progress", 99, 4, f"Saved to {filename}")

            # Mark as completed
            JOBS[job_id]["questions"] = generated_questions
            JOBS[job_id]["topics"] = list(set(q["topic"] for q in generated_questions))
            update_job_status("completed", 100, 4, "Question generation complete")
            
            # Log final statistics
            update_job_status("completed", 100, 4, f"Generated {len(generated_questions)} questions")
            update_job_status("completed", 100, 4, f"Found {len(JOBS[job_id]["topics"]) if JOBS[job_id]["topics"] else 0} unique topics")

    except Exception as e:
        error_msg = f"Error in question generation: {str(e)}"
        print(f"Job {job_id}: ERROR: {error_msg}")
        update_job_status("error", 100, 1, error_msg)
        raise

@app.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    question_language: str = Form(...),
    explanation_language: str = Form(...),
    number_of_questions: str = Form(...),
    output_format: str = Form(...),
):
    """Receive a document and metadata, return a job id after text extraction."""
    # Persist file to disk
    job_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{job_id}_{file.filename}"
    with save_path.open("wb") as buffer:
        buffer.write(await file.read())

    # Extract raw text (sync for now; for large files consider background task)
    try:
        raw_text = _extract_text(save_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {exc}")

    # Persist raw text to backend/uploads/<job_id>.txt so it's easily accessible later
    text_path = TEXT_DIR / f"{job_id}.txt"
    try:
        text_path.write_text(raw_text, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save extracted text: {exc}")

    JOBS[job_id] = {
        "step": 1,
        "progress": 20,
        "done": False,
    }

    background_tasks.add_task(
        _generate_async,
        job_id,
        raw_text,
        question_language,
        explanation_language,
        int(number_of_questions),
        output_format,
    )

    return JSONResponse(
        {
            "job_id": job_id,
            "raw_text_length": len(raw_text),
            "text_file": str(text_path.relative_to(Path(__file__).resolve().parent)),
            "message": "File received and processing started",
        }
    )


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a job."""
    try:
        if job_id not in JOBS:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job = JOBS[job_id]
        
        # Calculate ETA (estimated time remaining)
        if job["status"] == "in_progress":
            current_time = time.time()
            start_time = job.get("start_time", current_time)
            elapsed_time = current_time - start_time
            progress = job["progress"] / 100
            if progress > 0:
                total_time = elapsed_time / progress
                remaining_time = total_time * (1 - progress)
                eta = int(remaining_time)
            else:
                eta = 0
        else:
            eta = 0
        
        # Prepare response with all required fields
        response = {
            "status": job["status"],
            "progress": job["progress"],
            "step": job["step"],
            "logs": job["logs"],
            "questions_generated": len(job.get("questions", [])),
            "topics_detected": len(job.get("topics", [])),
            "questions_preview": job.get("questions", [])[:3],  # Show first 3 questions as preview
            "eta": eta,
            "error": job.get("error", None) if job["status"] == "error" else None,
            "questions": job.get("questions", []),  # Include all questions for download
            "topics": job.get("topics", [])
        }
        
        return response   
        return job
    except Exception as e:
        print(f"Error getting job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
