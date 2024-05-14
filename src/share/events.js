export const clientEvents = {
    outgoing: {
        READY: 'csReady',
        TOGGLE_DEBUG_MODE: 'csToggleDebugMode',
        INPUT: 'csInput'
    },
    incoming: {
        CLIENT_ID: 'scClientId',
        PLATFORM_INFO: 'scPlatformInfo',
        COLLIDER_INFO: 'scColliderInfo',
        CLEAR_COLLIDER_INFO: 'scClearColliderInfo',
        REMOVE_CLIENT: 'scRemoveClient',
        CURRENT_STATE: 'scCurrentState',
        INITIAL_STATE: 'scInitialState',
        RAYS: 'scRays'
    }
};

export const serverEvents = {
    incoming: {
        READY: 'csReady',
        TOGGLE_DEBUG_MODE: 'csToggleDebugMode',
        INPUT: 'csInput'
    },
    outgoing: {
        CLIENT_ID: 'scClientId',
        PLATFORM_INFO: 'scPlatformInfo',
        COLLIDER_INFO: 'scColliderInfo',
        CLEAR_COLLIDER_INFO: 'scClearColliderInfo',
        REMOVE_CLIENT: 'scRemoveClient',
        CURRENT_STATE: 'scCurrentState',
        INITIAL_STATE: 'scInitialState',
        RAYS: 'scRays'
    }
};

export function makeMessage(action, data) {
    const resp = {
        action: action,
        data: data
    };

    return JSON.stringify(resp);
}
