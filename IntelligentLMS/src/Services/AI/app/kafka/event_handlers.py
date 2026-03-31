import json
from functools import lru_cache
from app.data.dataset_builder import upsert_interaction, upsert_progress, upsert_course_popularity
from app.ml.recommendation_model import clear_recommendation_cache
from app.utils.logger import logger

# Deduplication using LRU cache as requested by User
@lru_cache(maxsize=10000)
def check_duplicate_event(event_hash: str):
    # This function only executes if event_hash is NOT in cache.
    # Therefore, if it executes, it was NOT a duplicate.
    return False

def _is_duplicate(event_hash: str) -> bool:
    # We call check_duplicate_event. 
    # If the cache is hit, it will return False. Wait, that doesn't work.
    pass

# A simpler, fully functional LRU dedup wrapper without abusing returning signatures:
class EventDedupCache:
    from collections import OrderedDict
    def __init__(self, capacity=10000):
        self.cache = self.OrderedDict()
        self.capacity = capacity
        
    def add(self, key: str) -> bool:
        """Returns True if it was already in cache (duplicate), False otherwise"""
        if key in self.cache:
            self.cache.move_to_end(key)
            return True
        self.cache[key] = True
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)
        return False

# Global instance
dedup_cache = EventDedupCache(10000)

def handle_user_registered(msg_data: dict):
    pass

def handle_course_enrolled(msg_data: dict):
    user_id = str(msg_data.get('userId'))
    course_id = str(msg_data.get('courseId'))
    upsert_interaction(user_id, course_id, action='enrolled')
    upsert_progress(user_id, course_id, progress=0.0, inc_lesson=False)
    upsert_course_popularity(course_id)
    clear_recommendation_cache()

def handle_lesson_completed(msg_data: dict):
    user_id = str(msg_data.get('userId'))
    course_id = str(msg_data.get('courseId'))
    progress = msg_data.get('progress') 
    upsert_interaction(user_id, course_id, action='completed_lesson')
    upsert_progress(user_id, course_id, progress=progress, inc_lesson=True)
    clear_recommendation_cache()

def handle_progress_updated(msg_data: dict):
    user_id = str(msg_data.get('userId'))
    course_id = str(msg_data.get('courseId'))
    progress = msg_data.get('progress')
    upsert_interaction(user_id, course_id, progress=progress, action='updated_progress')
    upsert_progress(user_id, course_id, progress=progress)
    clear_recommendation_cache()

def handle_course_rated(msg_data: dict):
    user_id = str(msg_data.get('userId'))
    course_id = str(msg_data.get('courseId'))
    rating = msg_data.get('rating')
    upsert_interaction(user_id, course_id, rating=rating, action='rated')
    upsert_course_popularity(course_id, rating_val=rating)
    clear_recommendation_cache()

EVENT_DISPATCH = {
    "user-registered": handle_user_registered,
    "course-enrolled": handle_course_enrolled,
    "lesson-completed": handle_lesson_completed,
    "progress-updated": handle_progress_updated,
    "course-rated": handle_course_rated
}

def process_message(topic: str, value: str):
    try:
        data = json.loads(value)
        
        # Deduplication using the precise user request hash algorithm
        event_hash = hash(json.dumps(data, sort_keys=True))
        
        if dedup_cache.add(event_hash):
            logger.debug(f"Duplicate event ignored. Topic {topic}, Hash {event_hash}")
            return
            
        handler = EVENT_DISPATCH.get(topic)
        if handler:
            handler(data)
            logger.info(f"Successfully processed event for {topic}: {data}")
        else:
            logger.warning(f"No handler configured for topic {topic}")
            
    except json.JSONDecodeError:
        logger.error(f"Failed to decode message: {value}")
    except Exception as e:
        logger.error(f"Error processing message from {topic}: {e}", exc_info=True)
