/**
 * AudioManager: Quản lý phát âm thanh tuân thủ chính sách Autoplay,
 * chống phát chồng lấn, có fallback dự phòng và hiển thị sóng âm trực quan.
 */
export class AudioManager {
  constructor(options = {}) {
    this.currentAudio = null;
    this.currentUrl = null;
    this.isPlaying = false;
    this.onStateChange = options.onStateChange || (() => {});
    this.onError = options.onError || (() => {});
  }

  /**
   * Dừng audio hiện tại nếu đang phát
   */
  stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
      } catch (e) {
        console.warn('Lỗi khi dừng audio:', e);
      }
      this.currentAudio = null;
    }
    this.isPlaying = false;
    this.onStateChange({ isPlaying: false, currentTime: 0, duration: 0 });
  }

  /**
   * Tải và phát âm thanh từ tương tác người dùng
   * @param {string} audioUrl Đường dẫn file mp3
   * @param {string} fallbackUrl Đường dẫn dự phòng
   */
  async play(audioUrl, fallbackUrl = '/audio/sample.mp3') {
    this.stop();

    try {
      this.currentUrl = audioUrl;
      const audio = new Audio(encodeURI(audioUrl));
      this.currentAudio = audio;

      audio.onplay = () => {
        this.isPlaying = true;
        this.onStateChange({ isPlaying: true, audio });
      };

      audio.onpause = () => {
        this.isPlaying = false;
        this.onStateChange({ isPlaying: false, audio });
      };

      audio.onended = () => {
        this.isPlaying = false;
        this.onStateChange({ isPlaying: false, isEnded: true, audio });
      };

      audio.onerror = async (err) => {
        console.warn(`Không phát được ${audioUrl}, chuyển sang fallback: ${fallbackUrl}`, err);
        if (fallbackUrl && audioUrl !== fallbackUrl) {
          try {
            await this.play(fallbackUrl, null);
          } catch (fallbackErr) {
            this.onError(fallbackErr);
          }
        } else {
          this.onError(err);
        }
      };

      await audio.play();
      this.isPlaying = true;
      return true;
    } catch (error) {
      console.warn('Lỗi autoplay hoặc không phát được audio:', error);
      this.isPlaying = false;
      this.onStateChange({ isPlaying: false, blocked: true });
      this.onError(error);
      return false;
    }
  }

  /**
   * Tạm dừng hoặc tiếp tục
   */
  toggle() {
    if (!this.currentAudio) return;
    if (this.isPlaying) {
      this.currentAudio.pause();
    } else {
      this.currentAudio.play().catch(err => this.onError(err));
    }
  }

  /**
   * Phát lại từ đầu
   */
  replay() {
    if (this.currentAudio) {
      this.currentAudio.currentTime = 0;
      this.currentAudio.play().catch(err => this.onError(err));
    } else if (this.currentUrl) {
      this.play(this.currentUrl);
    }
  }
}
