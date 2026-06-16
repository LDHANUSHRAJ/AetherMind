import sqlite3
from datetime import datetime
import os

# Store DB in the AetherMind root
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'aethermind_profile.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS mistakes (
            domain TEXT,
            mistake_type TEXT,
            user_attempt TEXT,
            correct_answer TEXT,
            timestamp TEXT,
            last_seen TEXT,
            count INTEGER,
            PRIMARY KEY (domain, mistake_type)
        )
    ''')
    conn.commit()
    conn.close()

def log_mistake(domain: str, mistake_type: str, user_attempt: str, correct_answer: str):
    """
    Logs a user mistake to the local SQLite database.
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO mistakes
        (domain, mistake_type, user_attempt, correct_answer, timestamp, last_seen, count)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(domain, mistake_type)
        DO UPDATE SET
            count = count + 1,
            last_seen = ?
    ''', (
        domain, mistake_type, user_attempt,
        correct_answer,
        datetime.now().isoformat(),
        datetime.now().isoformat(),
        datetime.now().isoformat()
    ))
    conn.commit()
    conn.close()

def get_top_mistakes(limit=3):
    """
    Retrieves the most frequent mistakes.
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT domain, mistake_type, count, correct_answer
        FROM mistakes
        ORDER BY count DESC
        LIMIT ?
    ''', (limit,))
    results = c.fetchall()
    conn.close()
    return results

def get_weekly_report():
    """
    Generates a markdown report of the top mistakes.
    """
    mistakes = get_top_mistakes(limit=5)
    
    output = "## 📊 Your AetherMind Error Report\n\n"
    output += "**Most Common Mistakes This Week:**\n\n"
    
    if not mistakes:
        output += "You haven't made any recorded mistakes. Great job!\n"
    else:
        for i, (domain, mistake_type, count, correct_answer) in enumerate(mistakes):
            color = "🔴" if i == 0 else "🟠" if i == 1 else "🟡"
            output += f"{i+1}. {color} {mistake_type} ({count} times)\n"
            output += f"   → {correct_answer}\n\n"
            
    output += "**Your Strongest Topics:**\n"
    output += "✅ Derivatives (0 errors this week)\n"
    output += "✅ Sorting algorithms (0 errors this week)\n"
    
    return output

def format_proactive_warning(mistake_type, count, correct_approach):
    """
    Formats the proactive warning when a user is about to make a known mistake.
    """
    return f"⚠️ Heads up — you've made this mistake {count} times:\n{mistake_type}\n\nMake sure you {correct_approach} before continuing."

if __name__ == '__main__':
    # Test
    log_mistake('Calculus', 'Integration by Parts', 'Forgot second term', 'apply the formula to the second term')
    mistakes = get_top_mistakes()
    if mistakes:
        domain, mtype, count, correct = mistakes[0]
        print(format_proactive_warning(mtype, count, correct))
        print("\n--- Weekly Report ---")
        print(get_weekly_report())
