import { ServerResponse } from "http";

export const handleError = (res: ServerResponse, errorCode: any, errorMessage: string) => {
  console.error(errorMessage);
  res.statusCode = errorCode;
  res.end(JSON.stringify({ error: errorMessage }));
}

export const sendJsonResponse = (res: ServerResponse, statusCode: number, data: any) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  if(data !== ""){
    res.end(JSON.stringify(data));
  }
  else{
    res.end();
  }
};

export const verifyDateStructure = (date: string) => { 
  return /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.test(date);  
}


// export const getQueryParams = (queryParams: URLSearchParams) => {
//   const skipParams = queryParams.get('skip');
//   const limitParams = queryParams.get('limit');

//   let skip = SKIP_DEFAULT;
//   if (skipParams != null) {
//     skip = parseInt(skipParams);
//     if (isNaN(skip) || skip < 0) {
//       skip = SKIP_DEFAULT;
//     }
//   }

//   let limit = LIMIT_DEFAULT;
//   if (limitParams != null) {
//     limit = parseInt(limitParams);
//     if (isNaN(limit) || limit <= 0) {
//       limit = LIMIT_DEFAULT;
//     }
//     else{
//       limit = Math.min(limit, LIMIT_DEFAULT);
//     }
//   }

//   return { skip, limit };
// };

