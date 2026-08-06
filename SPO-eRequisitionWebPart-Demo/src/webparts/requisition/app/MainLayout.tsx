import React, { useState, useEffect } from 'react';
import { Switch, Route, Link, Redirect, useLocation } from 'react-router-dom';
import Card from 'react-bootstrap/Card';

// Import style
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/main.css';

// Import component Page
import AllPA from '@/features/pa/components/AllPA';
import RequestPA from '@/features/pa/components/RequestPA';
import ApprovePA from '@/features/pa/components/ApprovePA';
import AllTA from '@/features/ta/components/AllTA';
import TradeAgreementView from '@/features/ta/components/TradeAgreementView';

// ─── 1. โครงสร้างข้อมูลเมนูและเส้นทาง (เหมือนเดิม) ───
interface ISubMenu {
    title: string;
    titleNav: string;
    icon: string;
    path: string;
}

interface IMenu {
    id: string;
    title: string;
    titleNav: string;
    icon: string;
    path?: string;
    subMenus?: ISubMenu[];
}

const MENU_ITEMS: IMenu[] = [
    {
        id: 'Promotion_Activities',
        title: 'Promotion Activities',
        titleNav: 'Promotion Activities',
        icon: 'fa fa-tags',
        subMenus: [
            { title: 'All Promotion Activities', titleNav: 'All Promotion Activities', icon: 'fa-minus', path: '/pa' },
            { title: 'Request', titleNav: 'Request Promotion Activities', icon: 'fa-minus', path: '/pa/request' },
            { title: 'Approve', titleNav: 'Approve Promotion Activities', icon: 'fa-minus', path: '/pa/approve' },
        ]
    },
    {
        id: 'Trade_Agreement',
        title: 'Trade Agreement',
        titleNav: 'Trade Agreement',
        icon: 'fa fa-handshake-o',
        subMenus: [
            { title: 'All Trade Agreement', titleNav: 'All Trade Agreement', icon: 'fa-minus', path: '/ta' },
        ]
    },
];

const MainLayout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
    const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({});
    // Bump this to force the currently active route's page component to remount
    // (e.g. clicking a sidebar link that's already the active page — React Router
    // doesn't remount on a no-op navigation, so nothing would otherwise refresh).
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // 🌟 2. ดึงข้อมูลตำแหน่ง URL ปัจจุบันมาใช้งาน
    const location = useLocation();

    const toggleSidebar = (): void => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const toggleSubMenu = (menuId: string): void => {
        setOpenSubMenus(prev => ({
            // Preserve every other parent menu's current expanded/collapsed state.
            ...prev,
            [menuId]: !prev[menuId]
        }));
    };

    // 🌟 3. ระบบ Auto-Expand: ตรวจสอบและกางเมนูย่อยอัตโนมัติเมื่อ URL ปัจจุบันตรงกับเมนูข้างใน
    useEffect(() => {
        const updatedOpenMenus: Record<string, boolean> = {};

        MENU_ITEMS.forEach((menu) => {
            if (menu.subMenus) {
                // เช็คว่าหน้าปัจจุบัน ตรงกับเมนูย่อยในกลุ่มนี้ไหม
                const hasActiveChild = menu.subMenus.some(sub => sub.path === location.pathname);
                if (hasActiveChild) {
                    updatedOpenMenus[menu.id] = true; // กางเฉพาะเมนูย่อยที่ตรงกับหน้าปัจจุบัน
                }
            }
        });

        // Auto-expand the active parent without changing any other parent's state.
        setOpenSubMenus(prev => ({
            ...prev,
            ...updatedOpenMenus,
        }));
    }, [location.pathname]);

    return (
        <div className={`requisition-app d-flex ${isSidebarOpen ? '' : 'toggled'}`} id="wrapper">

            {/* ─── Sidebar ด้านซ้าย ────────────────────────────────── */}
            <div className="bg-info-c1 text-white" id="sidebar-wrapper">
                <div className="list-group list-group-flush">

                    {MENU_ITEMS.map((menu) => {
                        const hasSubMenu = menu.subMenus && menu.subMenus.length > 0;
                        const isThisMenuOpen = !!openSubMenus[menu.id];

                        return (
                            <React.Fragment key={menu.id}>
                                {/* 🌟 แยกการทำงานระหว่างเมนูหลักที่มีลูก และไม่มีลูก */}
                                {hasSubMenu ? (
                                    /* ── กรณีที่ 1: "มี" เมนูย่อย (ทำหน้าที่กาง/หุบ) ── */
                                    <a
                                        href="#"
                                        className={`list-group-item list-group-item-action bg-info-c1 text-white p-3 fw-bold un-border ${isSidebarOpen ? 'd-flex justify-content-between align-items-center' : ''
                                            }`}
                                        onClick={(e) => {
                                            e.preventDefault(); // ป้องกันการรีเฟรชหน้า
                                            toggleSubMenu(menu.id); // สั่งกางเมนูย่อย
                                        }}
                                    >
                                        {isSidebarOpen ? (
                                            <>
                                                <div>
                                                    <i className={`fa ${menu.icon} me-2`}></i>
                                                    <span className="sidebar-text">{menu.title}</span>
                                                </div>
                                                <i className={`fa fa-chevron-${isThisMenuOpen ? 'up' : 'down'} sidebar-text`} style={{ fontSize: '0.64rem' }}></i>
                                            </>
                                        ) : (
                                            <>
                                                <i className={`fa ${menu.icon} me-2`}></i>
                                                <span className="sidebar-text">{menu.title}</span>
                                            </>
                                        )}
                                    </a>
                                ) : (
                                    /* ── กรณีที่ 2: "ไม่มี" เมนูย่อย (ทำหน้าที่เปลี่ยนหน้า) ── */
                                    <Link
                                        to={menu.path || '#'}
                                        className={`list-group-item list-group-item-action bg-info-c1 text-white p-3 fw-bold un-border ${location.pathname === menu.path ? 'active-menu' : ''
                                            }`}
                                    >
                                        <i className={`fa ${menu.icon} me-2`}></i>
                                        <span className="sidebar-text">{menu.title}</span>
                                    </Link>
                                )}

                                {/* เมนูย่อย (ถ้ามี) */}
                                {hasSubMenu && isThisMenuOpen && (
                                    <div className="bg-info-c1 text-white">
                                        {menu.subMenus!.map((sub, index) => {
                                            const isLinkActive = location.pathname === sub.path;

                                            return (
                                                <Link
                                                    key={index}
                                                    to={sub.path}
                                                    className={`list-group-item list-group-item-action bg-info-c1 text-white p-2 ps-5 un-border ${isLinkActive ? 'active-menu fw-bold' : ''
                                                        }`}
                                                    style={{ fontSize: '0.72rem' }}
                                                    onClick={(e) => {
                                                        if (isLinkActive) {
                                                            // Already on this page: <Link> won't cause React Router to
                                                            // remount, so force a refresh ourselves instead.
                                                            e.preventDefault();
                                                            setRefreshKey(prev => prev + 1);
                                                        }
                                                    }}
                                                >
                                                    <i className={`fa ${sub.icon} me-2`}></i>
                                                    <span className="sidebar-text">{sub.title}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}

                </div>
            </div>

            {/* ─── พื้นที่เนื้อหาหลักรวม Navbar ด้านบน ────────────────────── */}
            <div id="page-content-wrapper" className="w-100 d-flex flex-column">
                <nav className="navbar navbar-expand-lg navbar-light bg-light border-bottom px-3 bg-info-c1">
                    <div className="container-fluid">
                        <button className="btn btn-outline-c1" onClick={toggleSidebar}>
                            <i className="fa fa-bars fs-4 text-white"></i>
                        </button>
                        <div className="ms-auto"></div>
                    </div>
                </nav>

                <div className="flex-grow-1" style={{ backgroundColor: '#f3f3f4' }}>
                    <Card className='card-custom-main'>
                        <Card.Body>
                            {/* แสดง title ของเมนู */}
                            <h4>
                                {MENU_ITEMS.reduce<any[]>((acc, m) => [...acc, ...(m.subMenus || [m])], []).find(i => i.path === location.pathname)?.titleNav}
                            </h4>
                            <div className="breadcrumb">
                                <span><Link className="BreadCrumbRoot" to="/pa">E-Requisition</Link></span><span> &gt; </span><span className="BreadCrumbCurrent">{MENU_ITEMS.reduce<any[]>((acc, m) => [...acc, ...(m.subMenus || [m])], []).find(i => i.path === location.pathname)?.titleNav}</span>
                            </div>
                        </Card.Body>
                    </Card>

                    <div className="mt-3">
                        <Card className='card-custom-main' style={{ marginBottom: '150px' }}>
                            <Card.Body>
                                <Switch>
                                    <Route exact path="/pa" key={`pa-${refreshKey}`} component={AllPA} />
                                    <Route path="/pa/request" key={`pa-request-${refreshKey}`} component={RequestPA} />
                                    <Route path="/pa/approve" key={`pa-approve-${refreshKey}`} component={ApprovePA} />

                                    <Route path="/ta/request" component={TradeAgreementView} />
                                    <Route exact path="/ta" component={AllTA} />

                                    <Route path="/">
                                        <Redirect to="/pa" />
                                    </Route>
                                </Switch>
                            </Card.Body>
                        </Card>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default MainLayout;
