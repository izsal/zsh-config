-- general plugins
local plugins = {

  -- better scape shortcuts
  {
    "max397574/better-escape.nvim",
    event = "InsertEnter",
    config = function()
      require("better_escape").setup()
    end,
  },

  -- smooth scroll
  {
    "karb94/neoscroll.nvim",
    event = "InsertEnter",
    config = function()
      require("neoscroll").setup({})
    end,
  },

  -- odoo snippets
  {
    "L3MON4D3/LuaSnip",
    dependencies = {
      "mstuttgart/odoo-snippets",
    },
    config = function()
      require("luasnip.loaders.from_vscode").lazy_load()
    end,
  },

  -- configure notify
  {
    "rcarriga/nvim-notify",
    opts = {
      timeout = 5000,
      -- background_colour = "#000000",
      render = "wrapped-compact",
    },
  },

  -- csv colorizer
  {
    "cameron-wags/rainbow_csv.nvim",
    lazy = true,
    config = true,
    ft = {
      "csv",
      "tsv",
      "csv_semicolon",
      "csv_whitespace",
      "csv_pipe",
      "rfc_csv",
      "rfc_semicolon",
    },
    cmd = {
      "RainbowDelim",
      "RainbowDelimSimple",
      "RainbowDelimQuoted",
      "RainbowMultiDelim",
    },
  },

  -- theme for tokyonight
  { "folke/tokyonight.nvim", enabled = true },

  -- disable trouble
  { "catppuccin/nvim", enabled = false },
  { "folke/flash.nvim", enabled = false },
  { "nvim-neotest/neotest", enabled = false },
  { "mfussenegger/nvim-dap", enabled = false },
  { "folke/edgy.nvim", enabled = false },
  { "stevearc/overseer.nvim", enabled = false },
  { "ThePrimeagen/refactoring.nvim", enabled = false },
  { "echasnovski/mini.move", enabled = false },
  { "rafamadriz/friendly-snippets", enabled = false },
  { "folke/todo-comments.nvim", enabled = false },
  { "rcarriga/nvim-dap-ui", enabled = false },
  { "folke/todo-comments.nvim", enabled = false },
  { "lukas-reineke/indent-blankline.nvim", enabled = false },
}

return plugins
