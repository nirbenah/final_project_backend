import axios from "axios";
import { EVENT_URL } from "./const.js";

export interface APIResponse {
    status: APIStatus;
    data?: any;
}

export enum APIStatus {
    Success,
    BadRequest,
    Unauthorized,
    NotFound,
    ServerError
}


export const servicesApi = {
    getEvent: async (eventId) => {
        try {
            const res = await axios.get(`${EVENT_URL}/api/event/${eventId}`, { withCredentials: true });
            return { data: res.data, error: null };
        } catch (e) {
            console.error(e);
            return { data: null, error: e };
        }
    },
    incrementTicketsAvailability: async (eventId: string, name: string, quantity: number) => {
        try {
            const res = await axios.put(`${EVENT_URL}/api/event/${eventId}/tickets/inc`, { name, quantity }, { withCredentials: true });
            return { data: res.data, error: null };
        } catch (e) {
            console.error(e);
            return { data: null, error: e };
        }
    },
    decrementTicketsAvailability: async (eventId: string, name: string, quantity: number) => {
        try {
            const res = await axios.put(`${EVENT_URL}/api/event/${eventId}/tickets/dec`, { name, quantity }, { withCredentials: true });
            return { data: res.data, error: null };
        } catch (e) {
            console.error(e);
            return { data: null, error: e };
        }
    }

}
