import os
import sys
import asyncio
import edge_tts
import shutil

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Giọng đọc: NamMinh - giọng nam trầm ấm, tình cảm (warm male voice)
VOICE = "vi-VN-NamMinhNeural"

users = [
    # --- Các bà (bậc trên, kính trọng) ---
    ("Bà Chủ", "Nhân ngày 20 tháng 10, Chàu kính chúc Bà Chủ luôn dồi dào sức khỏe, tâm an vạn sự thành, gia đình hạnh phúc ấm êm và mãi mãi an nhiên, rực rỡ, kiếm được thật nhiều tiền!"),
    ("Bà Dũng", "Cháu kính chúc Bà Dũng nhân ngày Phụ nữ Việt Nam 20 tháng 10 thật nhiều sức khỏe, tinh thần vui vẻ, gia đình sum vầy và mọi điều bình an sẽ đến!"),
    ("Bà lỷ", "Cháu kính chúc Bà Lỷ nhân ngày 20 tháng 10 luôn mạnh khỏe, an nhiên, gặp nhiều may mắn và kiếm được thật nhiều tiền nhé!"),
    ("Bà nội", "Nhân ngày 20 tháng 10, con kính chúc Bà Nội luôn mạnh khỏe, sống lâu trăm tuổi, ăn ngon ngủ yên và ngập tràn tình yêu thương của con cháu!"),
    ("Bà Sè", "Cháu kính chúc Bà Sè nhân ngày Phụ nữ Việt Nam dồi dào sức khỏe, tâm hồn thư thái, vạn sự hanh thông và luôn an vui bên gia đình, kiếm được thật nhiều tiền hihi!"),
    ("Bà Sình", "Nhân ngày 20 tháng 10,cháu kính chúc Bà Sình luôn khỏe mạnh, an vui và gặp nhiều điều lành trong cuộc sống!"),
    ("Bà Sử", "Cháu kính chúc Bà Sử nhân ngày 20 tháng 10 bình an, hạnh phúc, sức khỏe dồi dào, gặp nhiều may mắn, kiếm được thật nhiều tiền ạ!"),

    # --- Bạn bè đồng trang lứa (khoảng 20 tuổi, thân mật) ---
    ("Chi", "Chúc Chi ngày 20 tháng 10 thật rực rỡ, học hành thuận lợi, đi đâu cũng gặp may và luôn giữ nụ cười tỏa nắng nhé, hi hi!"),
    ("Cô Duyên", "Chúc Cô Duyên ngày 20 tháng 10 thật xinh đẹp, tràn đầy năng lượng, mọi kế hoạch đều suôn sẻ và ngày nào cũng vui như Tết!"),
    ("Cô hoa", "Chúc Cô Hoa nhân ngày Phụ nữ Việt Nam luôn tươi thắm như tên gọi, xinh đẹp, nhiều niềm vui, làm việc gì cũng thành công và hạnh phúc mỗi ngày!"),
    ("Cô Huệ", "Chúc Cô Huệ ngày 20 tháng 10 rạng rỡ, may mắn ngập tràn, đường nào cũng thông, việc gì cũng xong và luôn cười vui mỗi ngày!"),
    ("Cô Lai", "Chúc Cô Lai nhân ngày 20 tháng 10 thật nhiều sức khỏe, xinh đẹp tỏa sáng, gặp toàn điều tốt lành và mọi ước mơ đều trở thành hiện thực!"),
    ("Cô Nhi", "Chúc Cô Nhi ngày 20 tháng 10 thật đáng yêu, xinh đẹp, dũng cảm theo đuổi đam mê và gặt hái thật nhiều thành công nhé!"),
    ("Cô tùng", "Chúc Cô Tùng nhân ngày Phụ nữ Việt Nam tràn đầy năng lượng, vạn sự như ý, luôn vui vẻ yêu đời và thành công trên con đường mình chọn!"),

    # --- Bậc trên một chút (trên 25 tuổi, kính trọng hơn) ---
    ("Cô Phương", "Cháu chúc Cô Phương nhân ngày 20 tháng 10 xinh đẹp, duyên dáng, công việc thuận lợi, gia đình hạnh phúc và vạn sự an khang, gặp nhiều may mắn, kiếm thật nhiều tiền ạ hi hi!"),
    ("Cô sinh", "Cháu chúc Cô Sinh ngày 20 tháng 10 luôn trẻ đẹp, mạnh khỏe, công việc hanh thông, gặp nhiều may mắn và kiếm được thật nhiều tiện ạ!"),

    # --- Gia đình & người thân thiết nhất ---
    ("ma ma", "Nhân ngày 20 tháng 10, con kính chúc mẹ luôn mạnh khỏe, bình an, hạnh phúc. Cảm ơn mẹ đã luôn yêu thương, che chở cho chúng con. Chúng con yêu Mẹ Mủa nhiều lắm!"),
    ("Bé Cưng", "Gửi Bé Cưng của nhân ngày 20 tháng 10! Chúc bé cưng luôn xinh đẹp, luôn vui vẻ, luôn mạnh khỏe và hạnh phúc. Cảm ơn bé cưng đã luôn ở bên, đồng hành cùng em. Em yêu bé cưng nhiều lắm, Bé Cưng à!"),
    ("Thím Tếnh", "Cháu chúc Thím nhân ngày Phụ nữ Việt Nam luôn mạnh khỏe, luôn vui vẻ, chúc thím luôn gặp được nhiều điều may mắn và kiếm được thật nhiều tiền ạ!"),
]

target_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "audio")
root_audio_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "audio")
os.makedirs(target_dir, exist_ok=True)
os.makedirs(root_audio_dir, exist_ok=True)

sample_file = os.path.join(target_dir, "sample.mp3")

async def generate_single(name, wish):
    out_path = os.path.join(target_dir, f"{name}.mp3")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 1000:
        print(f"Skipping already existing: {name}.mp3")
        return
    print(f"Generating audio for {name}...")
    full_text = f"Thân gửi {name}! {wish}"
    for attempt in range(3):
        try:
            tts = edge_tts.Communicate(full_text, VOICE)
            await tts.save(out_path)
            shutil.copy2(out_path, os.path.join(root_audio_dir, f"{name}.mp3"))
            print(f"✓ Completed {name}.mp3")
            return
        except Exception as e:
            print(f"Attempt {attempt+1} failed for {name}: {e}")
            await asyncio.sleep(1.5)

    # Fallback to sample.mp3
    if os.path.exists(sample_file):
        shutil.copy2(sample_file, out_path)
        shutil.copy2(sample_file, os.path.join(root_audio_dir, f"{name}.mp3"))
        print(f"✓ Fallback copied sample.mp3 for {name}.mp3")

async def main():
    for name, wish in users:
        await generate_single(name, wish)

if __name__ == "__main__":
    asyncio.run(main())