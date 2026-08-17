// import { useMemo } from "react";
// import {
//     routes,
//     guestRoutes,
//     userRoutes,
// //   adminRoutes,
// //   companyRoutes,
// //   userRoutes,
// } from "./Routes";
// import { useRoutes } from "react-router-dom";
// // import { useAuthContext } from "../contexts/auth/useAuthContext";

// export default function Router() {
//   //   const { role } = useAuthContext();
//   const role = "guest";

//   const roleRoutes = useMemo(() => {
//     if (!role || role === "guest") return [...routes, ...guestRoutes , userRoutes];
//     // if (role === "user") return [...routes, ...userRoutes];
//     // if (role === "admin") return [...routes, ...adminRoutes];
//     // if (role === "company") return [...routes, ...companyRoutes];
//     return routes; // default
//   }, [role]);

//   return useRoutes(roleRoutes);
// }


import { useRoutes } from "react-router-dom";
import { routes, guestRoutes, userRoutes } from "./Routes";

function Router() {
  const router = useRoutes([
    ...routes,
    ...guestRoutes,
    ...userRoutes,
  ]);

  return router;
}

export default Router;