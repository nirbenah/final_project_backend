export const API_ENDPOINTS = {
    // Users
    LOGIN: '/api/login',
    SIGNUP: '/api/signup',
    LOGOUT: '/api/logout',
    GET_USER: '/api/getUserInfo',
    UPDATE_PERMISSION: '/api/updatePermission',
    GET_USER_NEXT_EVENT: '/api/nextEvent/:id',

    // Comments
    GET_COMMENTS: '/api/comments',
    POST_COMMENT: '/api/comment',
    
    // Events
    GET_EVENTS: '/api/events',
    GET_EVENT: "/api/event/:id",
    GET_AVAILABLE_EVENTS: '/api/events/available',
    POST_EVENT: '/api/event',
    INC_EVENT_TICKETS: '/api/event/:id/tickets/inc',
    DEC_EVENT_TICKETS: '/api/event/:id/tickets/dec',
    PUT_EVENT_DATES: '/api/event/:id/dates',
    PUT_EVENT_COMMENTS: '/api/event/:id/comments',
    UPDATE_EVENT: '/api/updateEvent',

    // Orders
    GET_ORDERS_BY_USER: "/api/ordersByUserId",
    GET_ORDERS_BY_EVENT: "/api/ordersByEventId",
    POST_ORDER: "/api/order",
    UPDATE_ORDER: "/api/order/:id",
    DELETE_ORDER: "/api/order/:id",
    GET_NEXT_UPDATED_EVENT: '/api/order/nextEvent/:id'  ,
    PURCHASE: '/api/order/:id/purchase',
};
