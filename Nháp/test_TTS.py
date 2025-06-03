GOOGLE_API_KEY="AIzaSyCrv68G_8aHWcJ_zxFO6d196nhqFjrmSSE"
from google import genai
from google.genai import types
from pydub import AudioSegment
import io

client = genai.Client(api_key=GOOGLE_API_KEY)
MODEL_ID = "gemini-2.5-flash-preview-tts"

import contextlib
import wave
from IPython.display import Audio

file_index = 0

@contextlib.contextmanager
def wave_file(filename, channels=1, rate=44100, sample_width=2):
  with wave.open(filename, "wb") as wf:
    wf.setnchannels(channels)
    wf.setsampwidth(sample_width)
    wf.setframerate(rate)
    yield wf

def save_audio_blob(blob, filename=None, format='wav'):
  global file_index
  file_index += 1
  
  if filename is None:
    extension = 'mp3' if format == 'mp3' else 'wav'
    filename = f'audio_{file_index}.{extension}'
  
  if format == 'mp3':
    # Create a temporary WAV file in memory
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav:
      wav.setnchannels(1)
      wav.setsampwidth(2)
      wav.setframerate(44100)
      wav.writeframes(blob.data)
    
    # Convert WAV to MP3
    wav_buffer.seek(0)
    audio = AudioSegment.from_wav(wav_buffer)
    audio.export(filename, format="mp3", codec="mp3")
  else:
    # Save as WAV
    with wave_file(filename) as wav:
      wav.writeframes(blob.data)
  
  print(f"Audio saved as: {filename}")
  return filename

response = client.models.generate_content(
  model=MODEL_ID,
  contents="Say 'hello, my name is Gemini!'",
  config={"response_modalities": ['Audio']},
)

blob = response.candidates[0].content.parts[0].inline_data
print(blob.mime_type)

# Save the audio file as MP3
save_audio_blob(blob, "hello_gemini3.mp3", format='mp3')
