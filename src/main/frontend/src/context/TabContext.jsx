import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const TabContext = createContext();

export const useTabs = () => useContext(TabContext);

export const useTabPageState = (key, initialValue) => {
    const { activeTabId, getTabPageState, setTabPageState } = useTabs();
    const initialValueRef = useRef(initialValue);

    const getInitialValue = useCallback(() => {
        const savedValue = getTabPageState(activeTabId, key);

        if (savedValue !== undefined) {
            return savedValue;
        }

        const initialValueFactory = initialValueRef.current;
        return typeof initialValueFactory === 'function'
            ? initialValueFactory()
            : initialValueFactory;
    }, [activeTabId, getTabPageState, key]);

    const [value, setValue] = useState(getInitialValue);

    useEffect(() => {
        setValue(getInitialValue());
    }, [getInitialValue]);

    const setPersistedValue = useCallback((updater) => {
        setValue(prevValue => {
            const nextValue = typeof updater === 'function'
                ? updater(prevValue)
                : updater;

            setTabPageState(activeTabId, key, nextValue);
            return nextValue;
        });
    }, [activeTabId, key, setTabPageState]);

    return [value, setPersistedValue];
};

export const TabProvider = ({ children }) => {
    const [tabs, setTabs] = useState([{ id: 'home', title: '홈', path: '/home', closable: false }]);
    const [activeTabId, setActiveTabId] = useState('home');
    const [tabPageStates, setTabPageStates] = useState({});
    const navigate = useNavigate();
    const location = useLocation();

    const addTab = (id, title, path, navigateOptions = {}) => {
        setTabs((prevTabs) => {
            const existingTab = prevTabs.find((tab) => tab.id === id || tab.path === path);
            if (existingTab) {
                setActiveTabId(existingTab.id);
                return prevTabs.map((tab) =>
                    tab.id === existingTab.id
                        ? { ...tab, title, path, state: navigateOptions.state }
                        : tab
                );
            }
            const newTabs = [...prevTabs, { id, title, path, state: navigateOptions.state, closable: true }];
            setActiveTabId(id);
            return newTabs;
        });
        navigate(path, navigateOptions);
    };

    const removeTab = (id, e) => {
        if (e) e.stopPropagation();

        setTabPageStates(prevStates => {
            const nextStates = { ...prevStates };
            delete nextStates[id];
            return nextStates;
        });

        setTabs((prevTabs) => {
            const tabIndex = prevTabs.findIndex((tab) => tab.id === id);
            if (tabIndex === -1) return prevTabs;

            const newTabs = prevTabs.filter((tab) => tab.id !== id);

            if (activeTabId === id) {

                const nextTab = newTabs[tabIndex - 1] || newTabs[0];

                if (nextTab) {
                    // 이동할 탭이 있으면 해당 탭으로 전환
                    setActiveTabId(nextTab.id);
                    navigate(nextTab.path);
                } else {
                    // 모든 탭이 닫힌 경우 홈으로 이동
                    // (nextTab.id 호출 시 발생하는 오류 방지)
                    setActiveTabId('home');
                    navigate('/home');
                }
            }

            return newTabs;
        });
    };

    const switchTab = (id) => {
        const tab = tabs.find((t) => t.id === id);
        if (tab) {
            setActiveTabId(id);
            navigate(tab.path, { state: tab.state });
        }
    };

    const getTabPageState = useCallback((tabId, key) => {
        return tabPageStates?.[tabId]?.[key];
    }, [tabPageStates]);

    const setTabPageState = useCallback((tabId, key, value) => {
        setTabPageStates(prevStates => ({
            ...prevStates,
            [tabId]: {
                ...(prevStates[tabId] || {}),
                [key]: value,
            },
        }));
    }, []);

    // Synchronize activeTabId with URL when navigating (e.g., via browser back button)
    useEffect(() => {
        const currentTab = tabs.find(t => t.path === location.pathname);
        if (currentTab && currentTab.id !== activeTabId) {
            setActiveTabId(currentTab.id);
        }
    }, [location.pathname, tabs, activeTabId]);

    return (
        <TabContext.Provider value={{ tabs, activeTabId, addTab, removeTab, switchTab, getTabPageState, setTabPageState }}>
            {children}
        </TabContext.Provider>
    );
};
