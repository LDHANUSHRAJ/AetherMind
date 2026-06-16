import numpy as np
import os
import wave
import tempfile

def init_whisper_model():
    """
    Lazy load the whisper model to save memory if not used.
    """
    try:
        import whisper
        return whisper.load_model("medium")
    except ImportError:
        print("Whisper library not installed.")
        return None
    except Exception as e:
        print(f"Error loading whisper model: {e}")
        return None

def transcribe_audio(audio_path: str, model=None) -> str:
    """
    Transcribes audio entirely offline using whisper.
    """
    if model is None:
        model = init_whisper_model()
    if model is None:
        return "Transcription unavailable. Whisper not loaded."
        
    result = model.transcribe(
        audio_path,
        language="en",
        fp16=False
    )
    return result["text"].strip()

def record_audio(duration=10, sample_rate=16000, save_path=None):
    """
    Records audio using the local microphone and saves to a path if provided.
    Returns the numpy array of audio frames.
    """
    try:
        import pyaudio
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=sample_rate,
            input=True,
            frames_per_buffer=1024
        )
        frames = []
        raw_frames = []
        
        # In a real UI, we would display a waveform visualization here
        for _ in range(0, int(sample_rate / 1024 * duration)):
            data = stream.read(1024)
            raw_frames.append(data)
            frames.append(np.frombuffer(data, dtype=np.float32))
            
        stream.stop_stream()
        stream.close()
        p.terminate()
        
        # Optionally save to a wav file for whisper transcription
        if save_path:
            wf = wave.open(save_path, 'wb')
            wf.setnchannels(1)
            wf.setsampwidth(p.get_sample_size(pyaudio.paFloat32))
            wf.setframerate(sample_rate)
            wf.writeframes(b''.join(raw_frames))
            wf.close()
            
        return np.concatenate(frames)
    except ImportError:
        print("PyAudio not installed.")
        return None
    except Exception as e:
        print(f"Microphone error: {e}")
        return None

def process_silent_query(duration=5, solution_generator=None):
    """
    Full pipeline to record audio, transcribe, and output a silent solution.
    `solution_generator` is a callback that takes the transcribed text and returns the answer.
    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
        temp_path = temp_wav.name
        
    print("Recording...")
    record_audio(duration=duration, save_path=temp_path)
    
    if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
        transcription = transcribe_audio(temp_path)
        os.remove(temp_path)
    else:
        transcription = "Failed to record audio."
        
    if solution_generator:
        solution = solution_generator(transcription)
    else:
        solution = "[Answer logic goes here]"
        
    return format_silent_response(transcription, solution)


def format_silent_response(transcription, solution_text):
    """
    Formats the response UI output based on the feature requirements.
    """
    output = f"🎙 I heard: \"{transcription}\"\n"
    output += "[Confirm? Y/N button shown]\n\n"
    output += "## Solution\n"
    output += f"{solution_text}\n"
    output += "\n> [!NOTE]\n> Silent Mode Active: Result rendered visually with no audio feedback."
    return output

if __name__ == '__main__':
    # Test format
    print(format_silent_response("how to sort an array", "Here is how you sort an array:\n```python\narr.sort()\n```"))
