import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RecordVoiceOverRoundedIcon from "@mui/icons-material/RecordVoiceOverRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { BottomNavigation, BottomNavigationAction, Paper } from "@mui/material";
import type { ReactNode } from "react";
import type { AppRoutePath } from "../../types/ui";

interface BottomTabBarProps {
  activePath: AppRoutePath;
  onChange: (path: AppRoutePath) => void;
}

const tabs: Array<{ id: AppRoutePath; label: string; icon: ReactNode }> = [
  { id: "/home", label: "首页", icon: <HomeRoundedIcon /> },
  { id: "/practice", label: "练习", icon: <RecordVoiceOverRoundedIcon /> },
  { id: "/progress", label: "进度", icon: <TimelineRoundedIcon /> },
  { id: "/me", label: "我的", icon: <PersonRoundedIcon /> },
];

export const BottomTabBar = ({ activePath, onChange }: BottomTabBarProps) => {
  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "max(12px, env(safe-area-inset-bottom))",
        width: "min(420px, calc(100vw - 20px))",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(255, 253, 249, 0.95)",
        zIndex: 100,
      }}
    >
      <BottomNavigation
        value={activePath}
        onChange={(_event, value: AppRoutePath) => onChange(value)}
        showLabels
        sx={{ background: "transparent" }}
      >
        {tabs.map((tab) => (
          <BottomNavigationAction key={tab.id} label={tab.label} value={tab.id} icon={tab.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
};
