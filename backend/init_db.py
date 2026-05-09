from app.database import create_db_and_tables
import os

if __name__ == "__main__":
    print("Initializing database...")
    create_db_and_tables()
    print("Database initialized successfully.")
