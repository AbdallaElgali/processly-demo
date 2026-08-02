import { config } from './config';

const API_URL = config.api;
// Make sure this points to the router prefix where your endpoints live
const API_BASE_URL = API_URL + '/customers'; 

export interface Customer {
    id: string;
    alias_name: string;
    name: string | null;
}

// FIXED: Changed [Customer] (a tuple of exactly 1 item) to Customer[] (an array)
export const fetch_customers = async(): Promise<Customer[] | void> => {
    try {
        const response = await fetch(API_BASE_URL + '/');
        if (response.status === 200) {
            const data = await response.json();
            return data;
        } else {
            // FIXED: Passed a string to Error instead of the raw Response object
            throw new Error(`Request failed with status: ${response.status} ${response.statusText}`);
        }
    } catch (err) {
        throw err;
    }
}

export const create_customer = async (alias_name: string, name: string): Promise<void> => {
    try { 
        const response = await fetch(API_BASE_URL + '/', {
            method: 'POST',
            // FIXED: Added Content-Type so FastAPI knows it's receiving JSON
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ alias_name, name })
        });
        
        // FIXED: Check if the response was successful (catches 400/500 backend errors)
        if (!response.ok) {
            throw new Error(`Failed to create customer: ${response.statusText}`);
        }
    } catch (err) {
        console.error("Error creating customer:", err);
        throw err;
    }
};