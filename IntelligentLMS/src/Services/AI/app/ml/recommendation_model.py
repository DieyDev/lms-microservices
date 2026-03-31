import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler
from functools import lru_cache
from app.data.dataset_builder import get_courses_df, get_progress_df, get_interactions_df
from app.utils.logger import logger

# We use lru_cache to cache recommendations per user.
# The cache must be invalidated when new events arrive. We can simply clear it.
@lru_cache(maxsize=1000)
def recommend_courses_hybrid(user_id: str, top_n: int = 5) -> list[str]:
    """
    Hybrid Course Recommendation:
    1. Weighted Score: rating + category_match + popularity + progress_match
    2. Cosine Similarity: User Vector vs Course Vectors
    Final Score = 0.5 * Similarity + 0.5 * Weighted Score
    """
    try:
        courses_df = get_courses_df()
        progress_df = get_progress_df()
        interactions_df = get_interactions_df()
        
        if courses_df.empty:
            return []

        # Enrolled courses
        user_prog_df = progress_df[progress_df['user_id'] == user_id]
        enrolled_courses = user_prog_df['course_id'].tolist() if not user_prog_df.empty else []
        
        candidates_df = courses_df[~courses_df['course_id'].isin(enrolled_courses)].copy()
        
        if candidates_df.empty:
            return []

        # 1. Normalized Weighted Score
        scaler = MinMaxScaler()
        
        # Safe normalization for rating and popularity
        candidates_df[['norm_rating', 'norm_popularity']] = scaler.fit_transform(
            candidates_df[['rating', 'popularity']].fillna(0)
        )
        
        user_categories = set(courses_df[courses_df['course_id'].isin(enrolled_courses)]['category'].tolist())
        def calculate_category_sim(cat):
            if not user_categories:
                return 0.5
            return 1.0 if cat in user_categories else 0.0

        candidates_df['category_sim'] = candidates_df['category'].apply(calculate_category_sim)
        
        avg_prog = user_prog_df['progress_percentage'].mean() if not user_prog_df.empty else 0
        user_level = 1 if avg_prog < 50 else (2 if avg_prog < 80 else 3)
        
        def calculate_difficulty_match(course_level):
            if course_level == user_level: return 1.0
            if abs(course_level - user_level) == 1: return 0.5
            return 0.0
            
        candidates_df['progress_match'] = candidates_df['difficulty'].apply(calculate_difficulty_match)
        
        candidates_df['weighted_score'] = (
            0.4 * candidates_df['norm_rating'] +
            0.3 * candidates_df['category_sim'] +
            0.2 * candidates_df['norm_popularity'] +
            0.1 * candidates_df['progress_match']
        )
        
        # 2. Cosine Similarity Vectorization
        # Build User Vector: [avg_rating_given, user_level]
        user_interactions = interactions_df[interactions_df['user_id'] == user_id]
        avg_rating_given = user_interactions['rating'].mean() if not user_interactions.empty and not pd.isna(user_interactions['rating'].mean()) else 0.5
        # normalize
        user_vector = np.array([[avg_rating_given / 5.0, user_level / 3.0]])
        
        # Build Course Vectors: [norm_rating, norm_difficulty]
        course_vectors = np.column_stack((
            candidates_df['norm_rating'].values, 
            candidates_df['difficulty'].values / 3.0
        ))
        
        if course_vectors.shape[0] > 0 and user_vector.shape[1] == course_vectors.shape[1]:
            similarities = cosine_similarity(user_vector, course_vectors)[0]
            candidates_df['similarity_score'] = similarities
        else:
            candidates_df['similarity_score'] = 0.5 # Default fallback
            
        # Final Hybrid Score
        candidates_df['hybrid_score'] = 0.5 * candidates_df['similarity_score'] + 0.5 * candidates_df['weighted_score']
        
        recommended = candidates_df.sort_values(by='hybrid_score', ascending=False)
        return recommended.head(top_n)['course_id'].tolist()
        
    except Exception as e:
        logger.error(f"Error in recommendation logic: {e}")
        return []

def clear_recommendation_cache():
    recommend_courses_hybrid.cache_clear()
    logger.debug("Cleared recommendation cache.")
