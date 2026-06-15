import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TabContext = createContext();

export const useTabs = () => useContext(TabContext);

export const useTabPageState = (key, initialValue) => {
    const { activeTabId, getTabPageState, setTabPageState } = useTabs();
    const tabIdRef = useRef(activeTabId);
    const tabId = tabIdRef.current;
    const initialValueRef = useRef(initialValue);

    const getInitialValue = useCallback(() => {
        const savedValue = getTabPageState(tabId, key);

        if (savedValue !== undefined) {
            return savedValue;
        }

        const initialValueFactory = initialValueRef.current;
        return typeof initialValueFactory === 'function'
            ? initialValueFactory()
            : initialValueFactory;
    }, [getTabPageState, key, tabId]);

    const [value, setValue] = useState(getInitialValue);

    useEffect(() => {
        setTabPageState(tabId, key, value);
    }, [key, setTabPageState, tabId, value]);

    const setPersistedValue = useCallback((updater) => {
        setValue(updater);
    }, []);

    return [value, setPersistedValue];
};

export const TabProvider = ({ children }) => {
    const [tabs, setTabs] = useState([
        { id: 'home', title: '홈', path: '/home', closable: false }
    ]);
    const [activeTabId, setActiveTabId] = useState('home');
    const [tabPageStates, setTabPageStates] = useState({});
    const [recentlyClosedPath, setRecentlyClosedPath] = useState('');
    const pendingNavigationPathRef = useRef('');
    const navigate = useNavigate();
    const location = useLocation();

    const addTab = useCallback((id, title, path, navigateOptions = {}) => {
        setRecentlyClosedPath('');
        pendingNavigationPathRef.current = path;

        const existingTab = tabs.find((tab) => tab.id === id || tab.path === path);
        const previousTabId = existingTab?.id;
        const nextActiveTabId = id;
        const nextTabs = existingTab
            ? tabs.map((tab) =>
                tab.id === existingTab.id
                    ? { ...tab, id, title, path, state: navigateOptions.state }
                    : tab
            )
            : [
                ...tabs,
                { id, title, path, state: navigateOptions.state, closable: true }
            ];

        setTabs(nextTabs);
        setActiveTabId(nextActiveTabId);

        if (previousTabId && previousTabId !== id) {
            setTabPageStates(prevStates => {
                if (!prevStates[previousTabId] || prevStates[id]) {
                    return prevStates;
                }

                const nextStates = { ...prevStates };
                nextStates[id] = nextStates[previousTabId];
                delete nextStates[previousTabId];
                return nextStates;
            });
        }

        navigate(path, navigateOptions);
    }, [navigate, tabs]);

    const removeTab = useCallback((id, e) => {
        if (e) e.stopPropagation();

        const tabIndex = tabs.findIndex((tab) => tab.id === id);
        if (tabIndex === -1) return;

        const targetTab = tabs[tabIndex];
        if (!targetTab.closable) return;

        const nextTabs = tabs.filter((tab) => tab.id !== id);
        const nextTab = nextTabs[tabIndex - 1] || nextTabs[0];

        setRecentlyClosedPath(targetTab.path);
        setTabs(nextTabs);

        setTabPageStates(prevStates => {
            const nextStates = { ...prevStates };
            delete nextStates[id];
            return nextStates;
        });

        if (activeTabId === id) {
            if (nextTab) {
                pendingNavigationPathRef.current = nextTab.path;
                setActiveTabId(nextTab.id);
                navigate(nextTab.path, { state: nextTab.state });
            } else {
                pendingNavigationPathRef.current = '/home';
                setActiveTabId('home');
                navigate('/home');
            }
        }
    }, [activeTabId, navigate, tabs]);

    const switchTab = useCallback((id) => {
        const tab = tabs.find((item) => item.id === id);
        if (!tab) return;

        setRecentlyClosedPath('');
        pendingNavigationPathRef.current = tab.path;
        setActiveTabId(id);
        navigate(tab.path, { state: tab.state });
    }, [navigate, tabs]);

    const getTabPageState = useCallback((tabId, key) => {
        return tabPageStates?.[tabId]?.[key];
    }, [tabPageStates]);

    const setTabPageState = useCallback((tabId, key, value) => {
        setTabPageStates(prevStates => {
            if (Object.is(prevStates?.[tabId]?.[key], value)) {
                return prevStates;
            }

            return {
                ...prevStates,
                [tabId]: {
                    ...(prevStates[tabId] || {}),
                    [key]: value,
                },
            };
        });
    }, []);

    useEffect(() => {
        if (recentlyClosedPath && location.pathname !== recentlyClosedPath) {
            setRecentlyClosedPath('');
        }
    }, [location.pathname, recentlyClosedPath]);

    useEffect(() => {
        if (
            pendingNavigationPathRef.current &&
            pendingNavigationPathRef.current !== location.pathname
        ) {
            return;
        }

        if (pendingNavigationPathRef.current === location.pathname) {
            pendingNavigationPathRef.current = '';
        }

        const currentTab = tabs.find(tab => tab.path === location.pathname);

        if (currentTab && currentTab.id !== activeTabId) {
            setActiveTabId(currentTab.id);
        }
    }, [activeTabId, location.pathname, tabs]);

    const value = useMemo(() => ({
        tabs,
        activeTabId,
        recentlyClosedPath,
        addTab,
        removeTab,
        switchTab,
        getTabPageState,
        setTabPageState
    }), [
        tabs,
        activeTabId,
        recentlyClosedPath,
        addTab,
        removeTab,
        switchTab,
        getTabPageState,
        setTabPageState
    ]);

    return (
        <TabContext.Provider value={value}>
            {children}
        </TabContext.Provider>
    );
};
