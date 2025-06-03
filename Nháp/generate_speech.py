from google import genai # Sửa lại cách import
from google.genai import types # Sửa lại cách import
import os
import re
import time
import wave

# --- CẤU HÌNH ---
API_KEY = "AIzaSyCrv68G_8aHWcJ_zxFO6d196nhqFjrmSSE" 

MODEL_ID_TTS = "gemini-2.5-flash-preview-tts"
OUTPUT_SPEECH_DIR = "speech"
TEXT_FILE_PATH = "q1.txt" 

# PROMPT_FOR_TTS_VOICE_STYLE = """Bạn là một hướng dẫn viên chương trình thi. Hãy đọc các nội dung sau với giọng nam ấm, to, rõ ràng và tốc độ hơi nhanh.
# Khi đọc các phương án, ví dụ "Phương án A: Nội dung A", hãy đọc là "Phương án A. Nội dung A."."""
# Tạm thời bỏ qua prompt style phức tạp để tập trung vào việc tạo âm thanh cơ bản

API_CALL_DELAY = 1 

def save_wave_file(filename, pcm_data, channels=1, rate=24000, sample_width=2):
    try:
        with wave.open(filename, "wb") as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(sample_width) 
            wf.setframerate(rate)        
            wf.writeframes(pcm_data)
        print(f"  Đã lưu file WAV: {filename}")
    except Exception as e:
        print(f"  Lỗi khi lưu file WAV {filename}: {e}")

def configure_api_client():
    try:
        client = genai.Client(api_key=API_KEY) # Sử dụng genai.Client
        print("Đã cấu hình Google Generative AI Client thành công.")
        return client # Trả về client instance
    except Exception as e:
        print(f"Lỗi cấu hình Google Generative AI Client: {e}")
        return None

def parse_questions_from_file(filepath):
    questions_data = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"Lỗi: Không tìm thấy file {filepath}")
        return questions_data

    current_question_data = None
    for line_content in lines:
        line_stripped = line_content.strip()

        if not line_stripped: # Bỏ qua dòng trống hoàn toàn
            if current_question_data: # Nếu có câu hỏi đang xử lý thì lưu lại trước khi reset
                if current_question_data.get("text_cau_hoi"): # Chỉ lưu nếu có nội dung câu hỏi
                    questions_data.append(current_question_data)
                current_question_data = None # Reset cho khối mới (nếu dòng trống phân tách câu hỏi)
            continue

        # Regex cho ID: Bắt đầu bằng chữ cái hoặc số, có thể chứa gạch dưới, theo sau là dấu ':'
        id_match = re.match(r'^([A-Z0-9_]+):\s*(.*)', line_stripped)
        
        if id_match:
            if current_question_data and current_question_data.get("text_cau_hoi"): # Lưu câu hỏi cũ nếu có
                questions_data.append(current_question_data)
            
            question_id = id_match.group(1).strip()
            text_cau_hoi = id_match.group(2).strip()
            current_question_data = {
                "id": question_id,
                "text_cau_hoi": text_cau_hoi,
                "cac_phuong_an": {},
                "text_dap_an": ""
            }
        elif current_question_data: # Nếu đang trong một khối câu hỏi
            option_match = re.match(r"^(?:Phương án\s+)?([A-Z]):\s*(.*)", line_stripped, re.IGNORECASE)
            answer_match = re.match(r"Đáp án đúng:\s*(.*)", line_stripped, re.IGNORECASE)

            if option_match:
                key = option_match.group(1).upper()
                text = option_match.group(2).strip()
                current_question_data["cac_phuong_an"][key] = text
            elif answer_match:
                current_question_data["text_dap_an"] = answer_match.group(1).strip()
            # Các dòng khác không khớp sẽ bị bỏ qua
            
    # Lưu câu hỏi cuối cùng nếu có
    if current_question_data and current_question_data.get("text_cau_hoi"):
        questions_data.append(current_question_data)
            
    return questions_data

def generate_and_save_audio(model_client, text_to_speak, filename_base, part_suffix=""):
    if not text_to_speak:
        print(f"  Bỏ qua phần rỗng cho {filename_base}{part_suffix}")
        return
    
    safe_filename_base = re.sub(r'[\\/*?:"<>|]', "", filename_base)
    safe_part_suffix = re.sub(r'[\\/*?:"<>|]', "", part_suffix)
    
    output_filename_wav = f"{safe_filename_base}{safe_part_suffix}.wav"
    output_filepath_wav = os.path.join(OUTPUT_SPEECH_DIR, output_filename_wav)

    # final_text_for_api = f"{PROMPT_FOR_TTS_VOICE_STYLE}\n\nNội dung cần đọc: \"{text_to_speak}\""
    final_text_for_api = text_to_speak # Tạm thời chỉ dùng text gốc

    print(f"  Đang tạo audio cho: {output_filename_wav} (Nội dung: \"{final_text_for_api[:60]}...\")")

    try:
        # Sử dụng cách gọi API với client instance, giống như trong tài liệu/notebook
        response = model_client.models.generate_content( # model_client giờ là client
            model=MODEL_ID_TTS, # Chỉ định model ở đây
            contents=final_text_for_api, 
            config=types.GenerateContentConfig( # Sử dụng config (không phải generation_config)
                response_modalities=["AUDIO"]
            )
            # Cân nhắc thêm speech_config nếu muốn chọn giọng cụ thể sau này
            # config=types.GenerateContentConfig(
            #     response_modalities=["AUDIO"],
            #     speech_config=types.SpeechConfig(
            #         voice_config=types.VoiceConfig(
            #             prebuilt_voice_config=types.PrebuiltVoiceConfig(
            #                 voice_name='Kore' # Ví dụ
            #             )
            #         )
            #     )
            # )
        )
        
        audio_data_pcm = None
        # Truy cập dữ liệu audio theo cách của notebook/tài liệu
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            part = response.candidates[0].content.parts[0]
            if hasattr(part, 'inline_data') and part.inline_data and hasattr(part.inline_data, 'data'):
                audio_data_pcm = part.inline_data.data
        
        if audio_data_pcm:
            save_wave_file(output_filepath_wav, audio_data_pcm)
        else:
            print(f"  Lỗi: Không nhận được dữ liệu audio (PCM) cho {output_filename_wav}. Chi tiết Response:")
            print(f"    Full response object: {response}") # In response để debug

    except Exception as e:
        print(f"  Lỗi nghiêm trọng khi tạo audio cho {output_filename_wav}: {e}")
        # Cố gắng in thêm thông tin từ lỗi nếu có
        if hasattr(e, 'response'):
            print(f"    API Error Response: {e.response}")
        if hasattr(e, 'message'):
             print(f"    Error Message: {e.message}")
    
    time.sleep(API_CALL_DELAY)

def main():
    print(f"Sử dụng API Key: ...{API_KEY[-4:] if API_KEY != 'YOUR_GOOGLE_API_KEY_HERE' else 'CHƯA CẤU HÌNH!'}")
    if API_KEY == "YOUR_GOOGLE_API_KEY_HERE":
        print("VUI LÒNG THAY THẾ 'YOUR_GOOGLE_API_KEY_HERE' BẰNG API KEY CỦA BẠN TRONG FILE PYTHON.")
        return

    model_client = configure_api_client()
    if not model_client:
        return

    questions = parse_questions_from_file(TEXT_FILE_PATH)
    if not questions:
        print(f"Không có câu hỏi nào được phân tích từ file: {TEXT_FILE_PATH}. Kết thúc.")
        return

    if not os.path.exists(OUTPUT_SPEECH_DIR):
        os.makedirs(OUTPUT_SPEECH_DIR)
        print(f"Đã tạo thư mục: {OUTPUT_SPEECH_DIR}")

    print(f"\nBắt đầu tạo file âm thanh cho {len(questions)} câu hỏi...")

    for i, q_data in enumerate(questions):
        question_id = q_data["id"]
        print(f"\nĐang xử lý câu hỏi {i+1}/{len(questions)} (ID: {question_id})")

        if q_data["text_cau_hoi"]:
            # Tạm thời chỉ đọc nội dung câu hỏi, không kèm prompt style
            text_for_tts_q = q_data['text_cau_hoi']
            generate_and_save_audio(model_client, text_for_tts_q, question_id)

        if q_data["cac_phuong_an"]:
            for option_key, option_text in sorted(q_data["cac_phuong_an"].items()):
                # Tạm thời chỉ đọc nội dung phương án
                text_for_tts_o = f"Phương án {option_key}. {option_text}"
                generate_and_save_audio(model_client, text_for_tts_o, question_id, part_suffix=f"_{option_key}")
        
        if q_data["text_dap_an"]:
            # Tạm thời chỉ đọc nội dung đáp án
            text_for_tts_a = f"Đáp án đúng là {q_data['text_dap_an']}"
            generate_and_save_audio(model_client, text_for_tts_a, question_id, part_suffix="_ans")

    print("\nHoàn tất quá trình tạo file âm thanh!")

if __name__ == "__main__":
    main()
