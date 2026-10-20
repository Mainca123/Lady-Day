import confetti from 'canvas-confetti';

/**
 * GiftScene: Quản lý chuỗi mở quà theo State Machine chuẩn:
 * ARRIVING -> IDLE -> OPENING -> REVEALING -> MESSAGE -> COMPLETE
 */
export class GiftScene {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.state = 'ARRIVING'; // Ban đầu
    this.currentUser = null;

    this.onStateChange = options.onStateChange || (() => {});
    this.onPlayAudio = options.onPlayAudio || (() => {});
    this.onReplayAudio = options.onReplayAudio || (() => {});
    this.onBackToGlobe = options.onBackToGlobe || (() => {});

    this.initDOM();
  }

  /**
   * Khởi tạo DOM container và cấu trúc hộp quà 3D luxury
   */
  initDOM() {
    this.container.innerHTML = `
      <div class="gift-scene-wrapper" id="gift-scene-wrapper">
        <!-- Ánh sáng môi trường nền -->
        <div class="gift-ambient-glow"></div>
        <div class="gift-light-shafts" id="gift-light-shafts"></div>

        <!-- Sân khấu 3D Hộp quà -->
        <div class="gift-stage" id="gift-stage">
          <!-- Sóng xung kích nổ vàng rực rỡ -->
          <div class="explosion-shockwave" id="explosion-shockwave"></div>

          <div class="gift-box-3d" id="gift-box-3d">
            <!-- Nắp hộp quà -->
            <div class="gift-lid" id="gift-lid">
              <div class="lid-face lid-top">
                <div class="ribbon-cross-h"></div>
                <div class="ribbon-cross-v"></div>
                <div class="ribbon-bow">
                  <div class="bow-loop bow-left"></div>
                  <div class="bow-loop bow-right"></div>
                  <div class="bow-center"></div>
                </div>
              </div>
              <div class="lid-face lid-front"><div class="ribbon-stripe"></div></div>
              <div class="lid-face lid-back"><div class="ribbon-stripe"></div></div>
              <div class="lid-face lid-left"><div class="ribbon-stripe"></div></div>
              <div class="lid-face lid-right"><div class="ribbon-stripe"></div></div>
            </div>

            <!-- Thân hộp quà -->
            <div class="gift-body" id="gift-body">
              <div class="body-face body-front"><div class="ribbon-stripe"></div></div>
              <div class="body-face body-back"><div class="ribbon-stripe"></div></div>
              <div class="body-face body-left"><div class="ribbon-stripe"></div></div>
              <div class="body-face body-right"><div class="ribbon-stripe"></div></div>
              <div class="body-face body-bottom"></div>
              
              <!-- Ánh sáng vàng rực bên trong phát ra khi nổ -->
              <div class="internal-glow" id="internal-glow"></div>
            </div>

            <!-- Bóng đổ hộp quà có trọng lượng -->
            <div class="gift-shadow"></div>
          </div>
        </div>

        <!-- Món quà và Thẻ chúc mừng xuất hiện sau khi mở -->
        <div class="reveal-card-container" id="reveal-card-container">
          <div class="gift-reveal-card" id="gift-reveal-card">
            
            <!-- Huy hiệu chân dung người nhận -->
            <div class="recipient-badge">
              <div class="badge-avatar-ring">
                <img id="reveal-avatar" src="" alt="Chân dung" class="badge-avatar-img" />
              </div>
              <div class="recipient-name-tag" id="reveal-name"></div>
              <div class="recipient-role-tag" id="reveal-role"></div>
            </div>

            <!-- Món quà xuất hiện -->
            <div class="gift-item-display">
              <div class="gift-sparkle-stars">✨ 🎁 ✨</div>
              <h3 class="gift-item-title" id="reveal-gift-title"></h3>
              <p class="gift-item-desc" id="reveal-gift-desc"></p>
            </div>

            <!-- Lời chúc trang trọng & ấm áp -->
            <div class="wish-message-box">
              <div class="quote-mark">“</div>
              <p class="wish-message-text" id="reveal-wish-text"></p>
              <div class="quote-mark end-quote">”</div>
            </div>

            <!-- Thanh trạng thái âm thanh & visualizer -->
            <div class="audio-control-bar" id="audio-control-bar">
              <div class="sound-wave" id="sound-wave">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
              </div>
              <span class="audio-status-label" id="audio-status-label">Đang phát lời chúc...</span>
            </div>

            <!-- Các nút hành động hoàn tất trải nghiệm -->
            <div class="action-buttons-group">
              <button class="btn-secondary" id="btn-replay-audio">
                <span class="btn-icon">🔊</span>
                <span>Nghe lại lời nhắn</span>
              </button>
              <button class="btn-primary" id="btn-back-globe">
                <span class="btn-icon">🌍</span>
                <span>Quay lại địa cầu</span>
              </button>
            </div>

          </div>
        </div>

      </div>
    `;

    // Cache elements
    this.wrapper = this.container.querySelector('#gift-scene-wrapper');
    this.giftBox = this.container.querySelector('#gift-box-3d');
    this.giftLid = this.container.querySelector('#gift-lid');
    this.internalGlow = this.container.querySelector('#internal-glow');
    this.shockwave = this.container.querySelector('#explosion-shockwave');
    this.revealCard = this.container.querySelector('#reveal-card-container');
    this.lightShafts = this.container.querySelector('#gift-light-shafts');

    this.revealAvatar = this.container.querySelector('#reveal-avatar');
    this.revealName = this.container.querySelector('#reveal-name');
    this.revealRole = this.container.querySelector('#reveal-role');
    this.revealGiftTitle = this.container.querySelector('#reveal-gift-title');
    this.revealGiftDesc = this.container.querySelector('#reveal-gift-desc');
    this.revealWishText = this.container.querySelector('#reveal-wish-text');
    this.audioControlBar = this.container.querySelector('#audio-control-bar');
    this.audioStatusLabel = this.container.querySelector('#audio-status-label');
    this.soundWave = this.container.querySelector('#sound-wave');

    this.btnReplay = this.container.querySelector('#btn-replay-audio');
    this.btnBack = this.container.querySelector('#btn-back-globe');

    this.btnReplay.addEventListener('click', () => this.onReplayAudio());
    this.btnBack.addEventListener('click', () => this.onBackToGlobe());
  }

  /**
   * Bắt đầu chuỗi: Hộp quà nhảy vào và TỰ ĐỘNG NỔ TUNG NGAY LẬP TỨC
   * (Bỏ qua bước phải chạm tay vào hộp quà)
   * @param {Object} user 
   */
  start(user) {
    this.currentUser = user;

    // Cập nhật dữ liệu người nhận lên giao diện
    this.revealAvatar.src = encodeURI(user.image);
    this.revealName.textContent = user.name;
    this.revealRole.textContent = user.role || 'Người Thân Yêu';
    this.revealGiftTitle.textContent = user.giftTitle || 'Món Quà Đặc Biệt';
    this.revealGiftDesc.textContent = user.giftDescription || 'Gửi trao sự trân quý và yêu thương';
    this.revealWishText.textContent = user.wish;

    // Reset trạng thái visual
    this.wrapper.classList.remove('opening-active', 'revealed', 'complete');
    this.giftBox.classList.remove('is-open', 'box-explode');
    this.revealCard.classList.remove('show');
    this.internalGlow.style.opacity = '0';
    this.lightShafts.classList.remove('active');
    if (this.shockwave) this.shockwave.classList.remove('active');

    // 1. ARRIVING: Hộp quà nhảy vọt vào khung hình đầy năng lượng
    this.setState('ARRIVING');

    // 2. TỰ ĐỘNG NỔ TUNG NGAY khi chạm điểm rơi (~400ms sau cú nhảy vào)
    setTimeout(() => {
      this.triggerExplosion();
    }, 450);
  }

  /**
   * Kích hoạt hiệu ứng NỔ TUNG hộp quà & tung pháo sáng
   */
  triggerExplosion() {
    this.setState('OPENING');

    // Nắp bay tung và sóng xung kích nổ sáng
    this.giftBox.classList.add('is-open', 'box-explode');
    this.internalGlow.style.opacity = '1';
    this.lightShafts.classList.add('active');
    if (this.shockwave) this.shockwave.classList.add('active');

    // Bắn pháo hoa Confetti và bụi sao nhiều đợt
    this.fireConfetti();

    // 3. REVEALING: Món quà bay lên từ luồng sáng nổ tung và phát âm thanh
    setTimeout(() => {
      this.setState('REVEALING');
      this.revealCard.classList.add('show');

      // Bắt đầu phát âm thanh tương ứng ngay khi quà xuất hiện
      if (this.currentUser) {
        this.onPlayAudio(this.currentUser);
      }
    }, 850);

    // 4. MESSAGE: Lời chúc hiện rõ hoàn toàn
    setTimeout(() => {
      this.setState('MESSAGE');
    }, 1800);

    // 5. COMPLETE: Hoàn tất chuỗi
    setTimeout(() => {
      this.setState('COMPLETE');
      this.wrapper.classList.add('complete');
    }, 2600);
  }

  /**
   * Thay đổi trạng thái State Machine
   */
  setState(newState) {
    this.state = newState;
    this.wrapper.setAttribute('data-state', newState);
    this.onStateChange(newState);
  }

  /**
   * Reset toàn bộ trạng thái hộp quà và ẩn thẻ để trả lại quyền điều khiển cho Địa cầu
   */
  reset() {
    this.setState('IDLE');
    this.currentUser = null;
    this.wrapper.classList.remove('opening-active', 'revealed', 'complete');
    this.wrapper.removeAttribute('data-state');
    this.giftBox.classList.remove('is-open', 'box-explode');
    this.revealCard.classList.remove('show');
    this.internalGlow.style.opacity = '0';
    this.lightShafts.classList.remove('active');
    if (this.shockwave) this.shockwave.classList.remove('active');
    this.soundWave.classList.remove('active');
  }

  /**
   * Hiệu ứng pháo giấy confetti và vụ nổ bụi sao champagne gold bùng nổ mạnh mẽ
   */
  fireConfetti() {
    const defaults = {
      origin: { y: 0.62 },
      colors: ['#ffd700', '#f3e5ab', '#ffffff', '#38bdf8', '#ffaa00', '#e6c368']
    };

    // Vụ nổ trung tâm tốc độ cao
    confetti({
      ...defaults,
      particleCount: 80,
      spread: 70,
      startVelocity: 55
    });

    // Vụ nổ tán rộng bao phủ
    confetti({
      ...defaults,
      particleCount: 90,
      spread: 120,
      startVelocity: 45,
      decay: 0.9,
      scalar: 1.2
    });

    // Đợt bụi sao vàng lấp lánh thứ 2
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 60,
        spread: 140,
        startVelocity: 35,
        ticks: 250
      });
    }, 200);

    // Bắn từ 2 bên cánh
    setTimeout(() => {
      confetti({
        origin: { x: 0.2, y: 0.7 },
        angle: 60,
        spread: 65,
        particleCount: 45,
        colors: defaults.colors
      });
      confetti({
        origin: { x: 0.8, y: 0.7 },
        angle: 120,
        spread: 65,
        particleCount: 45,
        colors: defaults.colors
      });
    }, 350);
  }

  /**
   * Cập nhật trạng thái Audio Visualizer
   */
  updateAudioState({ isPlaying, blocked, isEnded }) {
    if (isPlaying) {
      this.soundWave.classList.add('active');
      this.audioStatusLabel.textContent = 'Đang phát lời nhắn thân thương...';
      this.audioControlBar.style.display = 'flex';
    } else if (blocked) {
      this.soundWave.classList.remove('active');
      this.audioStatusLabel.textContent = 'Nhấn "Nghe lại" để phát âm thanh';
      this.audioControlBar.style.display = 'flex';
    } else if (isEnded) {
      this.soundWave.classList.remove('active');
      this.audioStatusLabel.textContent = 'Đã phát xong lời nhắn';
    } else {
      this.soundWave.classList.remove('active');
    }
  }
}
