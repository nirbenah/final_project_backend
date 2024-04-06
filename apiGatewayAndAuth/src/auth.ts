import { API_ENDPOINTS } from './const.js';
import User from './models/User.js';
import jwt from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';

// Middleware function to verify user info from cookie and check permissions from DB
export const authMiddleware = async (req, res, next) => {
    const token = req.cookies.token;
    console.log(req.cookies.token);

    if (!token) {
        return res.status(401).json({ message: 'User info not found in cookie' });
    }

    let username;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        username = (payload as JwtPayload).username;
    }
    catch (e) {
        res.status(401).send('Invalid token');
        return;
    }

    try {
        // Fetch user from the database based on the username
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        const requiredPermission = getRequiredPermission(req.originalUrl);

        if (!user.permission.includes(requiredPermission)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        next();
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Function to map routes to required permissions
const getRequiredPermission = (url) => {
    const permissionsMap = {
        [API_ENDPOINTS.LOGIN]: '',
        [API_ENDPOINTS.SIGNUP]: '',
        [API_ENDPOINTS.LOGOUT]: '',
        [API_ENDPOINTS.GET_USER]: '',
        [API_ENDPOINTS.UPDATE_PERMISSION]: 'A',
        [API_ENDPOINTS.GET_COMMENTS]: '',
        [API_ENDPOINTS.POST_COMMENT]: '',
        [API_ENDPOINTS.GET_EVENT]: '',
        [API_ENDPOINTS.GET_EVENTS]: '',
        [API_ENDPOINTS.GET_AVAILABLE_EVENTS]: 'A,M,W',
        [API_ENDPOINTS.POST_EVENT]: 'A',
        [API_ENDPOINTS.INC_EVENT_TICKETS]: '',
        [API_ENDPOINTS.DEC_EVENT_TICKETS]: '',
        [API_ENDPOINTS.PUT_EVENT_DATES]: 'M,A',
        [API_ENDPOINTS.PUT_EVENT_COMMENTS]: '',
        [API_ENDPOINTS.UPDATE_EVENT]: 'M,A',
        [API_ENDPOINTS.GET_ORDERS_BY_EVENT]: '',
        [API_ENDPOINTS.GET_ORDERS_BY_USER]: '',
        [API_ENDPOINTS.POST_ORDER]: '',
        [API_ENDPOINTS.UPDATE_ORDER]: '',
        [API_ENDPOINTS.DELETE_ORDER]: '',
        [API_ENDPOINTS.GET_USER_NEXT_EVENT]: '',
        [API_ENDPOINTS.PURCHASE]: 'U',
    };
    return permissionsMap[url] || '';
};