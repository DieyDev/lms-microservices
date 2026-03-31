import networkx as nx
import pandas as pd
from app.data.dataset_builder import get_courses_df
from app.utils.logger import logger

class LearningPathService:
    _graph = None
    _last_course_count = 0

    @classmethod
    def _build_graph(cls):
        courses_df = get_courses_df()
        
        if courses_df.empty:
            cls._graph = nx.DiGraph()
            cls._last_course_count = 0
            return
            
        # Only rebuild if number of rows changes (a simple optimization for now)
        # Ideally, we hash the dataframe or trigger explicitly from dataset_builder
        if cls._graph is not None and len(courses_df) == cls._last_course_count:
            return

        logger.info("Rebuilding Learning Path Graph...")
        G = nx.DiGraph()
        
        for _, row in courses_df.iterrows():
            G.add_node(row['course_id'])
            
            if pd.notna(row['prerequisite_course_id']) and row['prerequisite_course_id'] != "":
                G.add_edge(row['prerequisite_course_id'], row['course_id'])
                
        cls._graph = G
        cls._last_course_count = len(courses_df)

    @classmethod
    def generate_path(cls, goal_course_id: str) -> list[str]:
        """
        Uses NetworkX to build a directed graph of courses based on prerequisites.
        Returns the traversing path to reach the goal.
        """
        cls._build_graph()
        G = cls._graph
        
        if not G or goal_course_id not in G:
            logger.warning(f"Goal course {goal_course_id} not found in graph.")
            return []
            
        ancestors = nx.ancestors(G, goal_course_id)
        subgraph = G.subgraph(list(ancestors) + [goal_course_id])
        
        if not nx.is_directed_acyclic_graph(subgraph):
            logger.error("Learning path has cyclic dependencies (not a DAG).")
            # Return partial path or empty to prevent infinite loops in UI
            return []
            
        path = list(nx.topological_sort(subgraph))
        return path

    @classmethod
    def force_rebuild(cls):
        cls._graph = None
        cls._build_graph()
