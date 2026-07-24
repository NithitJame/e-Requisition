import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

export interface IOption {
    value: string | number;
    label: string;
}

interface ISearchableSelectProps {
    options: IOption[];
    value?: IOption | IOption[] | null;
    onChange: (selected: any) => void;
    placeholder?: string;
    isMulti?: boolean;
    disabled?: boolean | undefined | any;
}

const SearchableSelect: React.FC<ISearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'กรุณาเลือกข้อมูล...',
    isMulti = false,
    disabled = false // 🌟 ตั้งค่าเริ่มต้นเป็น false
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, width: 0 });

    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleOpenMenu = () => {
        if (disabled) return; // 🌟 ถ้า disabled ให้หยุดการทำงานทันที

        if (dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setMenuCoords({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
        setIsOpen(true);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current && !dropdownRef.current.contains(target) &&
                (!menuRef.current || !menuRef.current.contains(target))
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleScroll = (event: Event) => {
            if (!isOpen) return;

            const target = event.target as Node;
            if (menuRef.current && menuRef.current.contains(target)) {
                return;
            }

            setIsOpen(false);
        };

        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const checkIsSelected = (option: IOption) => {
        if (!value) return false;
        if (isMulti) {
            return (value as IOption[]).some(item => item.value === option.value);
        }
        return (value as IOption).value === option.value;
    };

    const handleSelect = (option: IOption) => {
        if (isMulti) {
            const currentValue = (value as IOption[]) || [];
            const alreadySelected = checkIsSelected(option);

            let newValue;
            if (alreadySelected) {
                newValue = currentValue.filter(item => item.value !== option.value);
            } else {
                newValue = [...currentValue, option];
            }
            onChange(newValue);
        } else {
            onChange(option);
            setIsOpen(false);
        }
    };

    const handleRemove = (e: React.MouseEvent, optionToRemove: IOption) => {
        e.stopPropagation();
        if (disabled) return; // 🌟 ป้องกันการลบเมื่อโดน disabled

        if (isMulti) {
            const currentValue = (value as IOption[]) || [];
            onChange(currentValue.filter(item => item.value !== optionToRemove.value));
        } else {
            onChange(null);
        }
    };

    const renderValue = () => {
        if (!value || (Array.isArray(value) && value.length === 0)) {
            return <span className="text-muted">{placeholder}</span>;
        }

        if (isMulti) {
            const vals = value as IOption[];
            return (
                <div className="d-flex flex-wrap gap-1">
                    {vals.map(v => (
                        <span key={v.value} className="badge bg-secondary d-flex align-items-center p-2" style={{ fontSize: '0.55rem' }}>
                            {v.label}
                            {/* 🌟 ซ่อนหรือปรับสไตล์ปุ่มกากบาทเมื่อ disabled */}
                            <i
                                className="fa fa-times ms-2"
                                style={{
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    opacity: disabled ? 0.5 : 1
                                }}
                                onClick={(e) => handleRemove(e, v)}
                            ></i>
                        </span>
                    ))}
                </div>
            );
        }

        const singleVal = value as IOption;
        return (
            <div className="d-flex flex-wrap gap-1">
                <span className="badge bg-secondary d-flex align-items-center p-2" style={{ fontSize: '0.55rem' }}>
                    {singleVal.label}
                    {/* 🌟 ซ่อนหรือปรับสไตล์ปุ่มกากบาทเมื่อ disabled */}
                    <i
                        className="fa fa-times ms-2"
                        style={{
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.5 : 1
                        }}
                        onClick={(e) => handleRemove(e, singleVal)}
                    ></i>
                </span>
            </div>
        );
    };

    return (
        <>
            <div className="position-relative" ref={dropdownRef}>
                <div
                    className={`form-select text-start d-flex justify-content-between align-items-center ${disabled ? 'disabled' : ''}`}
                    onClick={() => {
                        if (disabled) return; // 🌟 กันไม่ให้กดเปิด
                        isOpen ? setIsOpen(false) : handleOpenMenu();
                    }}
                    style={{
                        cursor: disabled ? 'not-allowed' : 'pointer', // 🌟 เปลี่ยนรูปเมาส์
                        minHeight: '38px',
                        backgroundColor: disabled ? '#e9ecef' : '#fff' // 🌟 สีพื้นหลังตอน disable (มาตรฐาน Bootstrap)
                    }}
                >
                    <div style={{ flex: 1 }}>{renderValue()}</div>
                </div>
            </div>

            {isOpen && !disabled && ReactDOM.createPortal( // 🌟 เพิ่ม !disabled กันพลาดอีกชั้น
                <div
                    ref={menuRef}
                    className="dropdown-menu show p-0 shadow"
                    style={{
                        position: 'absolute',
                        top: menuCoords.top + 4,
                        left: menuCoords.left,
                        width: menuCoords.width,
                        zIndex: 9999
                    }}
                >
                    <div className="p-2 border-bottom bg-light rounded-top">
                        <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => {
                                const isSelected = checkIsSelected(option);
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`dropdown-item py-2 d-flex justify-content-between align-items-center ${isSelected ? 'active bg-secondary text-white' : ''}`}
                                        onClick={() => handleSelect(option)}
                                    >
                                        {option.label}
                                        {isSelected && <i className="fa fa-check"></i>}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center text-muted p-3" style={{ fontSize: '0.9rem' }}>
                                No result for "{searchTerm}"
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default SearchableSelect;