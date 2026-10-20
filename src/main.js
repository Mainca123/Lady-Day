import { users } from './data/users.js';
import { GlobeScene } from './components/GlobeScene.js';
import { GiftScene } from './components/GiftScene.js';
import { AudioManager } from './components/AudioManager.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý DOM Elements
  const globeScreen = document.getElementById('globe-screen');
  const giftScreen = document.getElementById('gift-screen');
  const canvasContainer = document.getElementById('canvas-container');
  const giftContainer = document.getElementById('gift-container');

  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmAvatar = document.getElementById('confirm-avatar');
  const confirmName = document.getElementById('confirm-name');
  const confirmRole = document.getElementById('confirm-role');
  const btnCancelSelect = document.getElementById('btn-cancel-select');
  const btnConfirmGift = document.getElementById('btn-confirm-gift');

  let selectedUser = null;

  // 2. Khởi tạo AudioManager
  const audioManager = new AudioManager({
    onStateChange: (state) => {
      giftScene.updateAudioState(state);
    },
    onError: (err) => {
      console.warn('Lỗi Audio:', err);
      giftScene.updateAudioState({ blocked: true });
    }
  });

  // 3. Khởi tạo GiftScene
  const giftScene = new GiftScene(giftContainer, {
    onPlayAudio: (user) => {
      // Bắt đầu phát âm thanh tương ứng với người dùng
      // Fallback về /audio/sample.mp3 nếu chưa có hoặc lỗi
      audioManager.play(user.audio, '/audio/sample.mp3');
    },
    onReplayAudio: () => {
      audioManager.replay();
    },
    onBackToGlobe: () => {
      // Dừng âm thanh
      audioManager.stop();

      // Reset hoàn toàn sân khấu quà để không che phủ chuột/chạm
      giftScene.reset();

      // Chuyển cảnh mượt mà về Địa cầu
      giftScreen.classList.remove('active');
      globeScreen.classList.remove('fade-out');

      // Khôi phục quyền tương tác xoay và chọn điểm sáng trên địa cầu
      globeScene.clearSelection();
      selectedUser = null;
    }
  });

  // 4. Khởi tạo GlobeScene
  const globeScene = new GlobeScene(canvasContainer, users, {
    onSelectUser: (user) => {
      selectedUser = user;
      showConfirmModal(user);
    }
  });

  // 5. Hiển thị Popup xác nhận
  function showConfirmModal(user) {
    confirmAvatar.src = encodeURI(user.image);
    confirmName.textContent = user.name;
    confirmRole.textContent = user.role || 'Người Thân Yêu';
    confirmOverlay.classList.add('show');
  }

  function hideConfirmModal() {
    confirmOverlay.classList.remove('show');
    globeScene.clearSelection();
    selectedUser = null;
  }

  // Nút "Chọn lại"
  btnCancelSelect.addEventListener('click', () => {
    hideConfirmModal();
  });

  // Nút "Nhận quà ngay"
  btnConfirmGift.addEventListener('click', () => {
    if (!selectedUser) return;

    confirmOverlay.classList.remove('show');

    // Chuyển cảnh mượt mà từ địa cầu sang trang mở quà (fade nối hai màn hình)
    globeScreen.classList.add('fade-out');

    setTimeout(() => {
      giftScreen.classList.add('active');
      giftScene.start(selectedUser);
    }, 450);
  });
});
