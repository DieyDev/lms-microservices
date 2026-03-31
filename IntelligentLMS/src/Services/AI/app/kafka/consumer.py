import threading
import time
from confluent_kafka import Consumer, KafkaException, KafkaError
from app.config import settings
from app.kafka.event_handlers import process_message
from app.data.dataset_builder import flush_cache
from app.utils.logger import logger

stop_event = threading.Event()

def start_kafka_consumer():
    """
    Reads Kafka topics synchronously in a background thread with Batch Processing.
    """
    conf = {
        'bootstrap.servers': settings.KAFKA_BOOTSTRAP_SERVERS,
        'group.id': settings.KAFKA_GROUP_ID,
        'auto.offset.reset': 'earliest',
        'enable.auto.commit': False # Manual commit for safety
    }

    try:
        consumer = Consumer(conf)
    except Exception as e:
        logger.error(f"Failed to initialize Kafka consumer: {e}")
        return

    topics = [
        settings.TOPIC_USER_REGISTERED,
        settings.TOPIC_COURSE_ENROLLED,
        settings.TOPIC_LESSON_COMPLETED,
        settings.TOPIC_PROGRESS_UPDATED,
        settings.TOPIC_COURSE_RATED
    ]

    consumer.subscribe(topics)
    logger.info(f"Kafka Consumer started for topics: {topics}...")

    batch_count = 0

    while not stop_event.is_set():
        try:
            msg = consumer.poll(timeout=1.0)
            
            if msg is None:
                continue
                
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logger.error(f"Consumer error: {msg.error()}")
                    continue

            # Valid message received
            topic = msg.topic()
            val = msg.value().decode('utf-8')
            
            process_message(topic, val)
            
            batch_count += 1
            if batch_count >= settings.KAFKA_BATCH_SIZE:
                # Flush to disk and commit offsets
                flush_cache()
                consumer.commit(asynchronous=True)
                logger.info(f"Kafka batch of {batch_count} committed & flushed to disk.")
                batch_count = 0
                
        except Exception as e:
            logger.error(f"Unexpected error in consumer loop: {e}", exc_info=True)

    # Shutdown procedure
    flush_cache()
    try:
        consumer.commit(asynchronous=False)
    except Exception as e:
        logger.error(f"Failed to commit consumer offsets during shutdown: {e}")
    finally:
        consumer.close()
    logger.info("Kafka Consumer stopped gracefully.")

def start_consumer_thread():
    stop_event.clear()
    thread = threading.Thread(target=start_kafka_consumer, daemon=True)
    thread.start()
    return thread

def stop_consumer_thread():
    stop_event.set()
