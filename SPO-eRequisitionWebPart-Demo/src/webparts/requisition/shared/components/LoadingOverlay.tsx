import React from 'react';

interface ILoadingOverlayProps {
    isLoading: boolean;
    text?: string; // เผื่ออยากเปลี่ยนข้อความตอนโหลด
}

const LoadingOverlay: React.FC<ILoadingOverlayProps> = ({
    isLoading,
    text = 'Loading...'
}) => {
    // ถ้าส่ง false มา ให้คืนค่า null (ไม่แสดงอะไรเลย)
    if (!isLoading) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.6)', // พื้นหลังสีดำโปร่งแสง
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999 // บังคับให้อยู่ชั้นบนสุดเสมอ
            }}
        >
            {/* วงล้อหมุนๆ ของ Bootstrap */}
            <div className="spinner-border text-light" role="status" style={{ width: '4rem', height: '4rem' }}>
                <span className="visually-hidden">Loading...</span>
            </div>
            {/* ข้อความแจ้งเตือน */}
            <h5 className="text-light mt-3">{text}</h5>
        </div>
    );
};

export default LoadingOverlay;