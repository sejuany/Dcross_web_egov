import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TabContext = createContext();

export const useTabs = () => useContext(TabContext);

export const TabProvider = ({ children }) => {
    const [tabs, setTabs] = useState([{ id: 'home', title: '홈', path: '/home', closable: false }]);
    const [activeTabId, setActiveTabId] = useState('home');
    const navigate = useNavigate();
    const location = useLocation();

    const addTab = (id, title, path) => {
        setTabs((prevTabs) => {
            const existingTab = prevTabs.find((tab) => tab.id === id);
            if (existingTab) {
                setActiveTabId(id);
                return prevTabs;
            }
            const newTabs = [...prevTabs, { id, title, path, closable: true }];
            setActiveTabId(id);
            return newTabs;
        });
        navigate(path);
    };

    const removeTab = (id, e) => {
        if (e) e.stopPropagation();

        setTabs((prevTabs) => {
            const tabIndex = prevTabs.findIndex((tab) => tab.id === id);
            if (tabIndex === -1) return prevTabs;

            const newTabs = prevTabs.filter((tab) => tab.id !== id);

            // If closing the active tab, switch to the last remaining tab
            if (activeTabId === id) {
                const nextTab = newTabs[tabIndex - 1] || newTabs[0];
                setActiveTabId(nextTab.id);
                navigate(nextTab.path);
            }

            return newTabs;
        });
    };

    const switchTab = (id) => {
        const tab = tabs.find((t) => t.id === id);
        if (tab) {
            setActiveTabId(id);
            navigate(tab.path);
        }
    };

    // Synchronize activeTabId with URL when navigating (e.g., via browser back button)
    useEffect(() => {
        const currentTab = tabs.find(t => t.path === location.pathname);
        if (currentTab && currentTab.id !== activeTabId) {
            setActiveTabId(currentTab.id);
        }
    }, [location.pathname, tabs, activeTabId]);

    return (
        <TabContext.Provider value={{ tabs, activeTabId, addTab, removeTab, switchTab }}>
            {children}
        </TabContext.Provider>
    );
};
