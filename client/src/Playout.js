import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function Playout(){
 return(
    <main>
        <Header />
        <Outlet />
    </main>
 )
}