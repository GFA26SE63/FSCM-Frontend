import { createContext } from 'react';

/**
 * false bên trong Modal/Drawer: bảng trong hộp thoại giữ trạng thái cục bộ,
 * không ghi bộ lọc lên URL của màn hình danh sách phía sau.
 */
export const UrlStateScope = createContext(true);
