export const ERROR_500 = "internal server error";
export const ERROR_400 = "invalid query parameters";
export const ERROR_404 = "event not found";

export const CATEGORY_TYPES = ['Charity Event', 'Concert', 'Conference', 'Convention', 'Exhibition', 'Festival', 'Product Launch', 'Sports Event'];

export const POST_EVENT = "/api/event";
export const GET_EVENT = "/api/event/:id";
export const GET_EVENTS = "/api/events";
export const GET_AVAILABLE_EVENTS = "/api/events/available";
export const INC_EVENT_TICKETS = "/api/event/:id/tickets/inc";
export const DEC_EVENT_TICKETS = "/api/event/:id/tickets/dec";
export const PUT_EVENT_DATES = "/api/event/:id/dates";
export const PUT_EVENT_COMMENTS = "/api/event/:id/comments";