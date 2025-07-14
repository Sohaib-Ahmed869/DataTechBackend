const Item = require("../models/items.model");

// Get all items with pagination and filtering
const getAllItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      category,
      salesItem = "tYES",
      valid = "tYES",
      sortBy = "ItemName",
      sortOrder = "asc",
    } = req.query;

    // Build filter object
    const filter = {};

    // Only show items that can be sold
    if (salesItem) {
      filter.SalesItem = salesItem;
    }

    // Only show valid items
    if (valid) {
      filter.Valid = valid;
    }

    // Category filter (if you have categories)
    if (category && category !== "all") {
      filter.ItemsGroupCode = parseInt(category);
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { ItemName: { $regex: search, $options: "i" } },
        { ItemCode: { $regex: search, $options: "i" } },
        { ForeignName: { $regex: search, $options: "i" } },
        { User_Text: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const items = await Item.find(filter)
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .select({
        ItemCode: 1,
        ItemName: 1,
        ForeignName: 1,
        ItemsGroupCode: 1,
        SalesVATGroup: 1,
        VatLiable: 1,
        SalesItem: 1,
        InventoryItem: 1,
        QuantityOnStock: 1,
        Valid: 1,
        ItemPrices: 1,
        User_Text: 1,
        U_SubCategory: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean();

    // Get total count
    const totalItems = await Item.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Process items to include default price
    const processedItems = items.map((item) => {
      // Get default price from price list (usually price list 1)
      let defaultPrice = 0;
      if (item.ItemPrices && item.ItemPrices.length > 0) {
        const defaultPriceEntry = item.ItemPrices.find(
          (price) => price.PriceList === 1
        );
        if (defaultPriceEntry) {
          defaultPrice = defaultPriceEntry.Price;
        } else {
          // If no price list 1, use the first available price
          defaultPrice = item.ItemPrices[0].Price;
        }
      }

      return {
        ...item,
        defaultPrice,
        isAvailable: item.QuantityOnStock > 0,
        category: item.U_SubCategory || "General",
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items: processedItems,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch items",
      error: error.message,
    });
  }
};

// Get item by ItemCode
const getItemByCode = async (req, res) => {
  try {
    const { itemCode } = req.params;

    const item = await Item.findOne({ ItemCode: itemCode }).lean();

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Get default price
    let defaultPrice = 0;
    if (item.ItemPrices && item.ItemPrices.length > 0) {
      const defaultPriceEntry = item.ItemPrices.find(
        (price) => price.PriceList === 1
      );
      if (defaultPriceEntry) {
        defaultPrice = defaultPriceEntry.Price;
      } else {
        defaultPrice = item.ItemPrices[0].Price;
      }
    }

    const processedItem = {
      ...item,
      defaultPrice,
      isAvailable: item.QuantityOnStock > 0,
      category: item.U_SubCategory || "General",
    };

    res.status(200).json({
      success: true,
      data: processedItem,
    });
  } catch (error) {
    console.error("Error fetching item by code:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid item code format",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to fetch item",
      error: error.message,
    });
  }
};

// Get available items (with stock)
const getAvailableItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = "ItemName",
      sortOrder = "asc",
    } = req.query;

    // Build filter for available items
    const filter = {
      SalesItem: "tYES",
      Valid: "tYES",
      QuantityOnStock: { $gt: 0 },
    };

    // Search functionality
    if (search) {
      filter.$or = [
        { ItemName: { $regex: search, $options: "i" } },
        { ItemCode: { $regex: search, $options: "i" } },
        { ForeignName: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    const items = await Item.find(filter)
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .select({
        ItemCode: 1,
        ItemName: 1,
        ForeignName: 1,
        QuantityOnStock: 1,
        ItemPrices: 1,
        U_SubCategory: 1,
      })
      .lean();

    const totalItems = await Item.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Process items
    const processedItems = items.map((item) => {
      let defaultPrice = 0;
      if (item.ItemPrices && item.ItemPrices.length > 0) {
        const defaultPriceEntry = item.ItemPrices.find(
          (price) => price.PriceList === 1
        );
        defaultPrice = defaultPriceEntry
          ? defaultPriceEntry.Price
          : item.ItemPrices[0].Price;
      }

      return {
        ...item,
        defaultPrice,
        category: item.U_SubCategory || "General",
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items: processedItems,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching available items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available items",
      error: error.message,
    });
  }
};

// Get item categories/groups
const getItemCategories = async (req, res) => {
  try {
    const categories = await Item.aggregate([
      {
        $match: {
          SalesItem: "tYES",
          Valid: "tYES",
        },
      },
      {
        $group: {
          _id: "$ItemsGroupCode",
          count: { $sum: 1 },
          categoryName: { $first: "$U_SubCategory" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const processedCategories = categories.map((cat) => ({
      id: cat._id,
      name: cat.categoryName || `Group ${cat._id}`,
      count: cat.count,
    }));

    res.status(200).json({
      success: true,
      data: processedCategories,
    });
  } catch (error) {
    console.error("Error fetching item categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item categories",
      error: error.message,
    });
  }
};

// Search items (for autocomplete/quick search)
const searchItems = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const searchRegex = new RegExp(q.trim(), "i");

    const items = await Item.find({
      SalesItem: "tYES",
      Valid: "tYES",
      $or: [
        { ItemName: searchRegex },
        { ItemCode: searchRegex },
        { ForeignName: searchRegex },
      ],
    })
      .limit(parseInt(limit))
      .select({
        ItemCode: 1,
        ItemName: 1,
        ForeignName: 1,
        ItemPrices: 1,
        QuantityOnStock: 1,
        U_SubCategory: 1,
      })
      .lean();

    // Process items for quick display
    const processedItems = items.map((item) => {
      let defaultPrice = 0;
      if (item.ItemPrices && item.ItemPrices.length > 0) {
        const defaultPriceEntry = item.ItemPrices.find(
          (price) => price.PriceList === 1
        );
        defaultPrice = defaultPriceEntry
          ? defaultPriceEntry.Price
          : item.ItemPrices[0].Price;
      }

      return {
        ItemCode: item.ItemCode,
        ItemName: item.ItemName,
        ForeignName: item.ForeignName,
        defaultPrice,
        QuantityOnStock: item.QuantityOnStock,
        category: item.U_SubCategory || "General",
        isAvailable: item.QuantityOnStock > 0,
      };
    });

    res.status(200).json({
      success: true,
      data: processedItems,
    });
  } catch (error) {
    console.error("Error searching items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search items",
      error: error.message,
    });
  }
};

module.exports = {
  getAllItems,
  getItemByCode,
  getAvailableItems,
  getItemCategories,
  searchItems,
};
