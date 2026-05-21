from huggingface_hub import snapshot_download
import os
import sys
import shutil

# Target Model: Unsloth Gemma 2 2B Instruct (completely public/ungated - no token/password needed!)
# 1. "unsloth/gemma-2-2b-it-bnb-4bit" (Lightweight, ~1.6 GB, perfect for low disk space)
# 2. "unsloth/gemma-2-2b-it" (Full precision, ~5.2 GB)
repo_id = "unsloth/gemma-2-2b-it-bnb-4bit"
local_dir = r"C:\Users\Dhanu\foundermind\model\base"

print("="*60)
print(f" AetherMind Base Model Downloader (Public/Ungated)")
print("="*60)
print(f"Target Repository : {repo_id}")
print(f"Target Directory  : {local_dir}")
print("HF Authentication : None Required (Public Ungated Repo)")
print("-"*60)

# Check disk space
target_drive = os.path.splitdrive(local_dir)[0] or "C:"
total, used, free = shutil.disk_usage(target_drive)

free_gb = free / (1024**3)
expected_size_gb = 1.65 # Estimated size for Gemma 2 2B 4-bit model

print(f"Free Disk Space   : {free_gb:.2f} GB on {target_drive}")

if free_gb < expected_size_gb:
    print("\n[!] WARNING: INSUFFICIENT DISK SPACE DETECTED!")
    print(f"    The model requires at least {expected_size_gb:.2f} GB of free space to download.")
    print(f"    You currently only have {free_gb:.2f} GB available.")
    print("\n[i] EASY FIX:")
    print("    Please free up just a tiny bit of disk space (about 300-500 MB) on your C: drive")
    print("    (e.g. by clearing temporary files or empty recycle bin) and then run this script!")
    print("-"*60)
    # We don't exit so they can attempt to download if they just cleared space
else:
    print("[+] Disk space looks good for 4-bit model!")
    print("-"*60)

# Create directory if it doesn't exist
if not os.path.exists(local_dir):
    try:
        os.makedirs(local_dir, exist_ok=True)
        print(f"Created directory: {local_dir}")
    except Exception as e:
        print(f"[!] Error creating directory: {e}")

print(f"\nStarting download of {repo_id}...")
try:
    snapshot_download(
        repo_id=repo_id,
        local_dir=local_dir,
        token=None # Public model, NO token required!
    )
    print("\n[+] Download completed successfully!")
    print("="*60)
except Exception as e:
    print(f"\n[-] An error occurred during download: {e}")
    print("\n[i] Troubleshooting:")
    print("1. Check if your internet connection is active.")
    print("2. Ensure you have freed up enough disk space.")
    print("="*60)
    sys.exit(1)


