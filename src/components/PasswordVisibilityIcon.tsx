import React from 'react';
import { MdOutlineVisibility, MdOutlineVisibilityOff } from 'react-icons/md';

interface PasswordVisibilityIconProps {
  show: boolean;
  size?: number;
  color?: string;
}

const PasswordVisibilityIcon: React.FC<PasswordVisibilityIconProps> = ({
  show,
  size = 22,
  color = '#1f2937',
}) => {
  const Icon = show ? MdOutlineVisibility : MdOutlineVisibilityOff;
  return <Icon size={size} color={color} style={{ display: 'inline-block', verticalAlign: 'middle' }} />;
};

export default PasswordVisibilityIcon;

