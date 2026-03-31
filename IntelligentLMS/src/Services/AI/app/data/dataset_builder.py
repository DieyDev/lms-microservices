import os
import pandas as pd
from datetime import datetime
from app.config import settings
from app.data.data_cache import data_cache
from app.utils.logger import logger

def get_interactions_df() -> pd.DataFrame:
    return data_cache.interactions_df

def get_courses_df() -> pd.DataFrame:
    return data_cache.courses_df

def get_progress_df() -> pd.DataFrame:
    return data_cache.progress_df

def upsert_interaction(user_id: str, course_id: str, rating: float = None, progress: float = None, action: str = ""):
    new_row = {
        'user_id': user_id,
        'course_id': course_id,
        'rating': rating,
        'progress': progress,
        'action': action,
        'timestamp': datetime.utcnow().isoformat()
    }
    data_cache.interactions_df = pd.concat(
        [data_cache.interactions_df, pd.DataFrame([new_row])], 
        ignore_index=True
    )
    data_cache.mark_dirty('interactions')
    
def upsert_course_popularity(course_id: str, rating_val: float = None):
    df = data_cache.courses_df
    mask = df['course_id'] == course_id
    if mask.any():
        idx = df.index[mask].tolist()[0]
        current_pop = df.at[idx, 'popularity']
        df.at[idx, 'popularity'] = int(current_pop) + 1 if pd.notna(current_pop) else 1
        if rating_val is not None:
            # Simple overwrite, real logic might average
            df.at[idx, 'rating'] = rating_val
    else:
        new_row = {
            'course_id': course_id, 
            'category': 'General', 
            'difficulty': 1, 
            'rating': rating_val if rating_val is not None else 0.0, 
            'popularity': 1,
            'prerequisite_course_id': None
        }
        data_cache.courses_df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        
    data_cache.mark_dirty('courses')

def upsert_progress(user_id: str, course_id: str, progress: float = None, inc_lesson: bool = False):
    df = data_cache.progress_df
    mask = (df['user_id'] == user_id) & (df['course_id'] == course_id)
    if mask.any():
        idx = df.index[mask].tolist()[0]
        if progress is not None:
            df.at[idx, 'progress_percentage'] = progress
        if inc_lesson:
            current_lessons = df.at[idx, 'lessons_completed']
            df.at[idx, 'lessons_completed'] = int(current_lessons) + 1 if pd.notna(current_lessons) else 1
        df.at[idx, 'last_login'] = datetime.utcnow().isoformat()
    else:
        new_row = {
            'user_id': user_id,
            'course_id': course_id,
            'progress_percentage': progress if progress is not None else 0.0,
            'lessons_completed': 1 if inc_lesson else 0,
            'last_login': datetime.utcnow().isoformat()
        }
        data_cache.progress_df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        
    data_cache.mark_dirty('progress')

def flush_cache():
    data_cache.flush()
