import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'https://emp-ljju.onrender.com/api/v1',
});

export default axiosInstance;
