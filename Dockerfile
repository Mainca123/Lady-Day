# ==========================================
# STAGE 1: Build source code bằng Node.js
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt dependencies trước để tận dụng Docker layer cache
COPY package*.json ./
RUN npm ci

# Copy toàn bộ mã nguồn và thư mục public (chứa ảnh & audio)
COPY . .

# Build ứng dụng sang thư mục /dist
RUN npm run build

# ==========================================
# STAGE 2: Khởi chạy Production bằng Nginx siêu nhẹ
# ==========================================
FROM nginx:alpine

# Copy cấu hình Nginx tối ưu cho SPA và media
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy bản build tĩnh từ stage 1 vào Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Mở cổng 80
EXPOSE 80

# Chạy Nginx ở chế độ foreground
CMD ["nginx", "-g", "daemon off;"]
