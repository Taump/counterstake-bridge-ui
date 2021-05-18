import React from "react";
import { Menu } from "antd";
import { NavLink } from "react-router-dom";

export const MainMenu = ({ mode, pathname, onClose, width }) => {

  const getPathnameForMenu = () => {
    if (pathname.startsWith("/user-guide"))
      return "/user-guide";
    return pathname;
  };

  return (
    <Menu
      mode={mode === "horizontal" ? "horizontal" : "vertical"}
      breakpoint="lg"
      overflowedIndicator=". . ."
      collapsedWidth="0"
      style={{ border: "none", float: 'right' }}
      selectedKeys={pathname !== "/" ? [getPathnameForMenu()] : []}
      onOpenChange={() => {
        onClose && onClose();
      }}
    >
      <Menu.Item key="/how-it-works">
        <NavLink to="/how-it-works" activeClassName="selected" style={{ verticalAlign: "middle" }}>
          How it works
        </NavLink>
      </Menu.Item>
      <Menu.Item key="/user-guide">
        <NavLink to="/user-guide" activeClassName="selected" style={{ verticalAlign: "middle" }}>
          User guide
        </NavLink>
      </Menu.Item>
      <Menu.Item key="/faq">
        <NavLink to="/faq" activeClassName="selected" style={{ verticalAlign: "middle" }}>
          F.A.Q.
        </NavLink>
      </Menu.Item>
    </Menu>
  );
};
