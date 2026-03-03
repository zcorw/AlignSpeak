import { Avatar, Box, Typography } from "@mui/material";

interface AppTopBarProps {
  userBadge: string;
}

export const AppTopBar = ({ userBadge }: AppTopBarProps) => {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between">
      <Box>
        <Typography variant="body2" color="text.secondary">
          欢迎回来
        </Typography>
        <Typography variant="h5" fontWeight={700}>
          AlignSpeak
        </Typography>
      </Box>
      <Avatar
        sx={{
          width: 38,
          height: 38,
          fontSize: 13,
          fontWeight: 700,
          background: "linear-gradient(135deg, #d85d3c, #f39a3d)",
        }}
      >
        {userBadge}
      </Avatar>
    </Box>
  );
};
