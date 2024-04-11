import fetch from 'node-fetch';

export interface PaymentPayload {
    cc: string;
    holder: string;
    cvv: number;
    exp: string;
    charge: number;
}

export const processPayment = async (payload): Promise<Response> => {
    console.log('making payment request',payload);
    // This is does not suppose to happen because the frontend should validate the input
    if (payload.cvv < 100 || payload.cvv > 999) {
        throw new Error('cvv has not 3 digits');
    }
    const pattern = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!pattern.test(payload.exp)) {
        throw new Error('exp is not valid');
    }
    if (payload.charge <= 0) {
        throw new Error('you can not charge negative number');
    }
    // Define the API endpoint URL
    const apiUrl = 'https://www.cs-wsp.net/_functions/pay';

    // Make a POST request to the API endpoint with the payload
    try{
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        return response;
    }
    catch(e){
        throw new Error('error in payment api making payment request');
    }
}


export const refund = async (payload: any): Promise<Response> => {
    // Define the API endpoint URL
    const apiUrl = 'https://www.cs-wsp.net/_functions/refund';

    // Make a POST request to the API endpoint with the payload
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    console.log("refund response");
    console.log(response);
    return response;

}