import os
import pandas as pd
import threading
from app.config import settings
from app.utils.logger import logger

class DataCache:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(DataCache, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
            
    def _initialize(self):
        self.interactions_df = self._ensure_csv(
            settings.INTERACTIONS_CSV, 
            ['user_id', 'course_id', 'rating', 'progress', 'action', 'timestamp']
        )
        self.courses_df = self._ensure_csv(
            settings.COURSES_CSV, 
            ['course_id', 'category', 'difficulty', 'rating', 'popularity', 'prerequisite_course_id']
        )
        self.progress_df = self._ensure_csv(
            settings.PROGRESS_CSV, 
            ['user_id', 'course_id', 'progress_percentage', 'lessons_completed', 'last_login']
        )
        self._dirty_flags = {
            'interactions': False,
            'courses': False,
            'progress': False
        }
        logger.info("DataCache initialized from CSVs.")

    def _ensure_csv(self, filepath: str, columns: list[str]) -> pd.DataFrame:
        if not os.path.exists(filepath):
            df = pd.DataFrame(columns=columns)
            df.to_csv(filepath, index=False)
            return df
        try:
            df = pd.read_csv(filepath)
            for col in columns:
                if col not in df.columns:
                    df[col] = None
            return df
        except Exception as e:
            logger.error(f"Error reading {filepath}: {e}")
            return pd.DataFrame(columns=columns)

    def mark_dirty(self, dataset: str):
        self._dirty_flags[dataset] = True

    def flush(self):
        with self._lock:
            if self._dirty_flags['interactions']:
                self.interactions_df.to_csv(settings.INTERACTIONS_CSV, index=False)
                self._dirty_flags['interactions'] = False
            
            if self._dirty_flags['courses']:
                self.courses_df.to_csv(settings.COURSES_CSV, index=False)
                self._dirty_flags['courses'] = False
                
            if self._dirty_flags['progress']:
                self.progress_df.to_csv(settings.PROGRESS_CSV, index=False)
                self._dirty_flags['progress'] = False
                
        logger.debug("DataCache flushed to disk.")

data_cache = DataCache()
