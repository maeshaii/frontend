import React, { useCallback } from 'react';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  currentIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onImageClick?: (index: number) => void;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  onPrevious,
  onNext,
  onImageClick
}) => {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowLeft') {
      onPrevious();
    } else if (e.key === 'ArrowRight') {
      onNext();
    }
  }, [onClose, onPrevious, onNext]);

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        cursor: 'pointer'
      }}
      onClick={handleOverlayClick}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: 40,
          height: 40,
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
        title="Close (ESC)"
      >
        ×
      </button>

      {/* Previous Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          style={{
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: 50,
            height: 50,
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          title="Previous (←)"
        >
          ‹
        </button>
      )}

      {/* Next Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          style={{
            position: 'absolute',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: 50,
            height: 50,
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          title="Next (→)"
        >
          ›
        </button>
      )}

      {/* Main Image */}
      <div
        style={{
          maxWidth: '95vw',
          maxHeight: '95vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (onImageClick) {
            onImageClick(currentIndex);
          }
        }}
      >
        <img
          src={
            typeof currentImage === 'string' && currentImage.startsWith('/media/')
              ? `http://127.0.0.1:8000${currentImage}`
              : typeof currentImage === 'string' && !currentImage.startsWith('http')
              ? `http://127.0.0.1:8000${currentImage}`
              : currentImage
          }
          alt={`${currentIndex + 1} of ${images.length}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}
          onLoad={(e) => {
            // Ensure the image displays at its natural size within constraints
            const img = e.target as HTMLImageElement;
            const naturalWidth = img.naturalWidth;
            const naturalHeight = img.naturalHeight;
            
            // If image is very tall (portrait), allow it to use more height
            if (naturalHeight > naturalWidth * 1.5) {
              img.style.maxHeight = '90vh';
              img.style.maxWidth = '80vw';
            }
            // If image is very wide (landscape), allow it to use more width
            else if (naturalWidth > naturalHeight * 1.5) {
              img.style.maxWidth = '90vw';
              img.style.maxHeight = '80vh';
            }
            // For square images, use balanced constraints
            else {
              img.style.maxWidth = '85vw';
              img.style.maxHeight = '85vh';
            }
          }}
        />
      </div>

      {/* Image Counter */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: 20,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            maxWidth: '80vw',
            overflowX: 'auto',
            padding: '0 20px',
          }}
        >
          {images.map((image, index) => (
            <img
              key={index}
              src={
                typeof image === 'string' && image.startsWith('/media/')
                  ? `http://127.0.0.1:8000${image}`
                  : typeof image === 'string' && !image.startsWith('http')
                  ? `http://127.0.0.1:8000${image}`
                  : image
              }
              alt={`${index + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                onImageClick?.(index);
              }}
              style={{
                width: 60,
                height: 60,
                objectFit: 'cover',
                borderRadius: 4,
                cursor: 'pointer',
                border: index === currentIndex ? '3px solid #0066cc' : '2px solid transparent',
                opacity: index === currentIndex ? 1 : 0.7,
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoGalleryModal;
