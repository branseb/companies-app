import { useState } from "react";
import { Drawer, Box, IconButton, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

type SideDrawerProps = {
    children?: React.ReactNode
}

const drawerWidth = 300;

export const SideDrawer = (props: SideDrawerProps) => {
    const { children } = props;
    const [open, setOpen] = useState(false);

    return (
        <>
            <Drawer
                anchor="left"
                open={open}
                transitionDuration={0}
                onClose={() => setOpen(false)}
                slotProps={{
                    paper: {
                        sx: {
                            width: drawerWidth,
                        },
                    }
                }}
            >
                {children}
            </Drawer>

            <IconButton
                onClick={() => setOpen(!open)}
                sx={{
                    position: "fixed",
                    top: "50%",
                    left: open ? drawerWidth + 20 : 20,
                    transform: "translate(-50%, -50%)",
                    transition: "none",
                    zIndex: 1300,
                    backgroundColor: "primary.main",
                    color: "white",
                    borderRadius: "0 40px 40px 0",
                    "&:hover": { backgroundColor: "primary.dark" },
                }}
            >
                {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
        </>
    );
}