import sqlite3
import secrets
import hashlib
from datetime import datetime, timedelta

DB = 'aethermind.db'

def init_db():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS api_keys (
            id          INTEGER PRIMARY KEY,
            key_hash    TEXT UNIQUE NOT NULL,
            key_prefix  TEXT NOT NULL,
            label       TEXT,
            expiry      TEXT,
            created_at  TEXT NOT NULL,
            last_used   TEXT,
            uses        INTEGER DEFAULT 0,
            is_active   INTEGER DEFAULT 1
        )
    ''')
    conn.commit()
    conn.close()

def generate_key(label: str, duration: str) -> dict:
    # Map duration choice to actual expiry datetime
    durations = {
        "1 Day":       timedelta(days=1),
        "3 Days":      timedelta(days=3),
        "1 Week":      timedelta(weeks=1),
        "1 Month":     timedelta(days=30),
        "3 Months":    timedelta(days=90),
        "Never":       None
    }

    # Generate cryptographically secure key
    raw_key = f"am-{secrets.token_hex(24)}"

    # Hash it — NEVER store raw key in DB
    key_hash = hashlib.sha256(
        raw_key.encode()
    ).hexdigest()

    # Calculate expiry
    now = datetime.utcnow()
    delta = durations.get(duration)
    expiry = (now + delta).isoformat() if delta else "never"

    # Store in database
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('''
        INSERT INTO api_keys
        (key_hash, key_prefix, label,
         expiry, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    ''', (
        key_hash,
        raw_key[:14] + "...",
        label or "Unnamed Key",
        expiry,
        now.isoformat()
    ))
    conn.commit()
    conn.close()

    return {
        "key":        raw_key,
        "prefix":     raw_key[:14] + "...",
        "label":      label or "Unnamed Key",
        "expiry":     expiry,
        "created_at": now.isoformat()
    }

def validate_key(raw_key: str) -> bool:
    key_hash = hashlib.sha256(
        raw_key.encode()
    ).hexdigest()

    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('''
        SELECT expiry, is_active
        FROM api_keys
        WHERE key_hash = ?
    ''', (key_hash,))
    row = c.fetchone()

    if not row:
        conn.close()
        return False

    expiry, is_active = row

    # Check if deactivated
    if not is_active:
        conn.close()
        return False

    # Check if expired
    if expiry != "never":
        expiry_dt = datetime.fromisoformat(expiry)
        if datetime.utcnow() > expiry_dt:
            # Auto-deactivate expired key
            c.execute('''
                UPDATE api_keys
                SET is_active = 0
                WHERE key_hash = ?
            ''', (key_hash,))
            conn.commit()
            conn.close()
            return False

    # Valid — update usage stats
    c.execute('''
        UPDATE api_keys
        SET uses = uses + 1,
            last_used = ?
        WHERE key_hash = ?
    ''', (datetime.utcnow().isoformat(), key_hash))
    conn.commit()
    conn.close()
    return True

def list_keys() -> list:
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('''
        SELECT key_prefix, label,
               expiry, created_at,
               last_used, uses, is_active
        FROM api_keys
        ORDER BY created_at DESC
    ''')
    rows = c.fetchall()
    conn.close()

    keys = []
    now = datetime.utcnow()
    for row in rows:
        prefix, label, expiry, created, \
        last_used, uses, is_active = row

        # Determine status
        if not is_active:
            status = "Revoked"
        elif expiry == "never":
            status = "Active — Never expires"
        else:
            expiry_dt = datetime.fromisoformat(expiry)
            if now > expiry_dt:
                status = "Expired"
            else:
                remaining = expiry_dt - now
                days = remaining.days
                hours = remaining.seconds // 3600
                if days > 0:
                    status = f"Active — {days}d {hours}h left"
                else:
                    status = f"Active — {hours}h left"

        keys.append({
            "prefix":   prefix,
            "label":    label,
            "status":   status,
            "expiry":   expiry,
            "created":  created[:10],
            "last_used": last_used[:10] if last_used else "Never",
            "uses":     uses
        })
    return keys

def revoke_key(key_prefix: str) -> bool:
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute('''
        UPDATE api_keys
        SET is_active = 0
        WHERE key_prefix = ?
    ''', (key_prefix,))
    affected = c.rowcount
    conn.commit()
    conn.close()
    return affected > 0
