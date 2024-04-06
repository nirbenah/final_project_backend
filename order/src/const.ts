
export const API_GATEWAY_URL = "http://localhost:4000";
export const COMMENT_URL = "http://localhost:5000";
export const EVENT_URL = "http://localhost:6000";
export const ORDER_URL = "http://localhost:7000";

export const GET_ORDERS_BY_USER = "/api/ordersByUserId";
//http://localhost:7000/api/ordersByUserId?page=1&limit=2&id=10

export const GET_ORDERS_BY_EVENT = "/api/ordersByEventId";
//http://localhost:7000/api/ordersByEventId?page=1&limit=2&id=10


export const POST_ORDER = "/api/order";
export const PURCHASE = "/api/order/:id/purchase";
export const INITIATE_TIMED_CHECKOUT = "/api/order/:id/initiateTimedCheckout";
//http://localhost:7000/api/order/
//BODY

export const UPDATE_ORDER = "/api/order/:id";
export const DELETE_ORDER = "/api/order/:id";
//http://localhost:7000/api/order/id

export const GET_NEXT_EVENT = '/api/order/nextEvent/:id' 

