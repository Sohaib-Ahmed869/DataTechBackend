const axios = require("axios");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// SAP B1 Service Layer Configuration
const SAP_CONFIG = {
  serviceLayerUrl: process.env.SAP_SERVICE_LAYER_URL,
  companyDB: process.env.COMPANY_DB,
  username: process.env.USER_NAME,
  password: process.env.PASSWORD,
};

// Configuration - Set your desired currency
const DEFAULT_CURRENCY = "AED"; // Change this to your base currency
const DEFAULT_PRICE_LIST = 1; // FIXED: Use price list 1 which has AED currency
const ENABLE_SAP_SYNC = true;

// Session management
let sessionId = null;
let sessionTimeout = null;

// Login to SAP B1 Service Layer
async function loginToSAP() {
  try {
    console.log("🔐 Logging in to SAP B1 Service Layer...");
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
    }

    const loginData = {
      CompanyDB: SAP_CONFIG.companyDB,
      UserName: SAP_CONFIG.username,
      Password: SAP_CONFIG.password,
    };

    const response = await axios.post(
      `${SAP_CONFIG.serviceLayerUrl}/Login`,
      loginData,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const cookies = response.headers["set-cookie"];
    if (!cookies) {
      throw new Error("No cookies returned from SAP B1 login");
    }

    const sessionCookie = cookies.find((cookie) =>
      cookie.includes("B1SESSION=")
    );
    if (!sessionCookie) {
      throw new Error("B1SESSION cookie not found");
    }

    sessionId = sessionCookie.split(";")[0].replace("B1SESSION=", "");

    // Set session timeout (25 minutes)
    sessionTimeout = setTimeout(() => {
      sessionId = null;
    }, 25 * 60 * 1000);

    console.log("✅ Successfully logged in to SAP B1 Service Layer");
    return sessionId;
  } catch (error) {
    console.error("❌ Error logging in to SAP B1:", error.message);
    if (error.response) {
      console.error("SAP Login Error details:", error.response.data);
    }
    throw new Error(`SAP Login Error: ${error.message}`);
  }
}

// Get valid session ID
async function getSessionId() {
  if (!sessionId) {
    return await loginToSAP();
  }
  return sessionId;
}

// Check if business partner exists
async function checkBusinessPartnerExists(cardCode) {
  try {
    const sessionId = await getSessionId();
    console.log(`🔍 Checking if business partner ${cardCode} exists in SAP...`);

    const response = await axios.get(
      `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners('${cardCode}')`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `B1SESSION=${sessionId}`,
        },
      }
    );

    console.log(`✅ Business partner ${cardCode} exists in SAP`);
    return true;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`❌ Business partner ${cardCode} does not exist in SAP`);
      return false;
    }
    if (error.response && error.response.status === 401) {
      console.log("🔄 Session expired, attempting to login again...");
      sessionId = null;
      await getSessionId();
      return checkBusinessPartnerExists(cardCode);
    }
    console.error("❌ Error checking business partner in SAP:", error.message);
    throw new Error(`SAP Error: ${error.message}`);
  }
}

// Get company currency information
async function getCompanyCurrencyInfo() {
  try {
    const sessionId = await getSessionId();
    console.log("🏢 Getting company currency information...");

    let baseCurrency = DEFAULT_CURRENCY;
    const exchangeRates = {};

    // Try to get company info
    try {
      const companyResponse = await axios.get(
        `${SAP_CONFIG.serviceLayerUrl}/CompanyService_GetCompanyInfo`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      if (companyResponse.data && companyResponse.data.LocalCurrency) {
        baseCurrency = companyResponse.data.LocalCurrency;
        console.log(`✅ Company base currency: ${baseCurrency}`);
      }
    } catch (companyError) {
      console.warn("⚠️ Could not get company info:", companyError.message);
    }

    // Get available currencies and exchange rates
    try {
      const currenciesResponse = await axios.get(
        `${SAP_CONFIG.serviceLayerUrl}/Currencies`,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      if (currenciesResponse.data && currenciesResponse.data.value) {
        currenciesResponse.data.value.forEach((currency) => {
          exchangeRates[currency.Code] = {
            rate: currency.Rate || 1,
            name: currency.CurrencyName,
            default: currency.Default === "tYES",
          };
        });
      }
    } catch (currencyError) {
      console.warn("⚠️ Could not get currencies:", currencyError.message);
    }

    return {
      baseCurrency,
      exchangeRates,
      isDefaultBase: baseCurrency === DEFAULT_CURRENCY,
    };
  } catch (error) {
    console.warn("⚠️ Currency info error:", error.message);
    return {
      baseCurrency: DEFAULT_CURRENCY,
      exchangeRates: {},
      isDefaultBase: true,
    };
  }
}

// Enhanced format order for SAP with AED-focused approach
async function formatOrderForSAP(order) {
  const today = new Date().toISOString().split("T")[0];
  console.log("🔧 Formatting order for SAP with AED-focused approach...");

  // Get currency information
  const currencyInfo = await getCompanyCurrencyInfo();
  const { baseCurrency, exchangeRates } = currencyInfo;

  console.log(`💱 Currency Analysis:`, {
    baseCurrency,
    orderCurrency: order.DocCurrency || DEFAULT_CURRENCY,
    defaultPriceList: DEFAULT_PRICE_LIST,
    availableRates: Object.keys(exchangeRates),
  });

  // Create SAP order with AED-focused configuration
  const sapOrder = {
    CardCode: order.CardCode,
    DocDate: order.DocDate
      ? new Date(order.DocDate).toISOString().split("T")[0]
      : today,
    DocDueDate: order.DocDueDate
      ? new Date(order.DocDueDate).toISOString().split("T")[0]
      : today,
    Comments: order.Comments || "",
    // CRITICAL FIX: Use price list 1 which has AED currency
    PriceList: DEFAULT_PRICE_LIST,
    DocumentLines: [],
  };

  // IMPORTANT: Do not set DocCurrency at all - let SAP use the price list currency
  console.log(`✅ Using Price List ${DEFAULT_PRICE_LIST} (AED currency)`);

  // Process document lines with AED-focused pricing
  if (order.DocumentLines && Array.isArray(order.DocumentLines)) {
    sapOrder.DocumentLines = order.DocumentLines.map((line, index) => {
      const sapLine = {
        ItemCode: line.ItemCode,
        Quantity: Number(line.Quantity || 0),
        UnitPrice: Number(line.Price || line.UnitPrice || 0),
        ItemDescription: line.ItemDescription || "",
        // CRITICAL FIX: Force price list 1 for all lines
        PriceList: DEFAULT_PRICE_LIST,
        LineNum: index,
      };

      // DO NOT set any currency fields at line level
      console.log(
        `📋 Line ${index}: ${line.ItemCode} - Price List ${DEFAULT_PRICE_LIST}`
      );

      return sapLine;
    });
  }

  // Add sales agent if available
  if (order.salesAgent) {
    sapOrder.U_SalesAgentId = order.salesAgent.toString();
  }

  console.log("📋 Final SAP order (AED-focused):", {
    CardCode: sapOrder.CardCode,
    PriceList: sapOrder.PriceList,
    DocumentLines: sapOrder.DocumentLines.length,
    sampleLine: sapOrder.DocumentLines[0],
  });

  return sapOrder;
}

// Enhanced create sales order with multiple fallback strategies
async function createSalesOrderInSAP(orderData) {
  try {
    if (!ENABLE_SAP_SYNC) {
      console.log("⚠️ SAP sync is disabled. Skipping order creation in SAP.");
      return {
        simulated: true,
        message: "SAP sync is disabled",
        DocEntry: Math.floor(Math.random() * 10000),
      };
    }

    const sessionId = await getSessionId();
    console.log("🚀 Creating sales order in SAP B1...");
    console.log("📋 Order data:", JSON.stringify(orderData, null, 2));

    // Strategy 1: Try with the provided data (should work now with price list 1)
    try {
      const response = await axios.post(
        `${SAP_CONFIG.serviceLayerUrl}/Orders`,
        orderData,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: `B1SESSION=${sessionId}`,
          },
        }
      );

      console.log("✅ Sales order created successfully in SAP B1!");
      console.log("📄 SAP DocEntry:", response.data.DocEntry);
      return response.data;
    } catch (initialError) {
      console.log("❌ Initial attempt failed:", initialError.message);

      if (
        initialError.response?.data?.error?.message?.value?.includes(
          "exchange rate"
        )
      ) {
        console.log(
          "🔄 Exchange rate error detected, trying fallback strategies..."
        );

        // Strategy 2: Remove price list completely
        const noPriceListOrder = {
          CardCode: orderData.CardCode,
          DocDate: orderData.DocDate,
          DocDueDate: orderData.DocDueDate,
          Comments: orderData.Comments,
          DocumentLines: orderData.DocumentLines.map((line, index) => ({
            ItemCode: line.ItemCode,
            Quantity: line.Quantity,
            UnitPrice: line.UnitPrice,
            ItemDescription: line.ItemDescription,
            LineNum: index,
            // Remove PriceList completely
          })),
        };

        if (orderData.U_SalesAgentId) {
          noPriceListOrder.U_SalesAgentId = orderData.U_SalesAgentId;
        }

        console.log("🎯 Strategy 2: No price list approach...");
        try {
          const response2 = await axios.post(
            `${SAP_CONFIG.serviceLayerUrl}/Orders`,
            noPriceListOrder,
            {
              headers: {
                "Content-Type": "application/json",
                Cookie: `B1SESSION=${sessionId}`,
              },
            }
          );

          console.log("✅ Order created without price list!");
          return response2.data;
        } catch (error2) {
          console.log("❌ No price list approach failed:", error2.message);

          // Strategy 3: Ultra-minimal order
          const ultraMinimalOrder = {
            CardCode: orderData.CardCode,
            DocumentLines: orderData.DocumentLines.map((line, index) => ({
              ItemCode: line.ItemCode,
              Quantity: line.Quantity,
              UnitPrice: line.UnitPrice,
              LineNum: index,
            })),
          };

          console.log("🎯 Strategy 3: Ultra-minimal order...");
          try {
            const response3 = await axios.post(
              `${SAP_CONFIG.serviceLayerUrl}/Orders`,
              ultraMinimalOrder,
              {
                headers: {
                  "Content-Type": "application/json",
                  Cookie: `B1SESSION=${sessionId}`,
                },
              }
            );

            console.log("✅ Order created with ultra-minimal approach!");
            return response3.data;
          } catch (error3) {
            console.log("❌ Ultra-minimal approach failed:", error3.message);
            throw new Error(
              `All strategies failed. Please check SAP B1 configuration:
1. Verify Price List 1 is properly configured for AED
2. Check item master data currency settings
3. Verify business partner currency configuration
Original error: ${
                initialError.response?.data?.error?.message?.value ||
                initialError.message
              }`
            );
          }
        }
      } else {
        // Not a currency error, re-throw
        throw initialError;
      }
    }
  } catch (error) {
    console.error("❌ Error creating sales order in SAP B1:", error.message);

    if (error.response) {
      console.error("SAP Error Response:", error.response.status);
      console.error(
        "SAP Error Data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    // Handle session expiration
    if (error.response && error.response.status === 401) {
      console.log("🔄 Session expired, attempting to login again...");
      sessionId = null;
      await getSessionId();
      return createSalesOrderInSAP(orderData);
    }

    throw new Error(`SAP Error: ${error.message}`);
  }
}

// Test SAP connection
async function testSAPConnection() {
  try {
    console.log("🧪 Testing SAP B1 connection...");
    const sessionId = await getSessionId();

    const response = await axios.get(
      `${SAP_CONFIG.serviceLayerUrl}/BusinessPartners?$top=1`,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `B1SESSION=${sessionId}`,
        },
      }
    );

    const currencyInfo = await getCompanyCurrencyInfo();

    console.log("✅ SAP B1 connection test successful!");
    return {
      success: true,
      status: response.status,
      message: "Connection successful",
      currencyInfo: currencyInfo,
    };
  } catch (error) {
    console.error("❌ SAP B1 connection test failed:", error.message);
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      details: error.response?.data,
    };
  }
}

// Check and setup exchange rates
async function checkAndSetupExchangeRates() {
  try {
    console.log("🔧 Checking exchange rates setup...");
    const currencyInfo = await getCompanyCurrencyInfo();

    console.log("💱 Available exchange rates:", currencyInfo.exchangeRates);

    // Check if we need to setup exchange rates for our default currency
    if (
      !currencyInfo.isDefaultBase &&
      !currencyInfo.exchangeRates[DEFAULT_CURRENCY]
    ) {
      console.log(`⚠️ ${DEFAULT_CURRENCY} exchange rate not found`);
      console.log(
        "Please set up exchange rates in SAP B1 Administration > System Initialization > General Settings > Currencies"
      );
    }

    return currencyInfo;
  } catch (error) {
    console.error("❌ Error checking exchange rates:", error.message);
    throw error;
  }
}

module.exports = {
  loginToSAP,
  getSessionId,
  checkBusinessPartnerExists,
  formatOrderForSAP,
  createSalesOrderInSAP,
  getCompanyCurrencyInfo,
  testSAPConnection,
  checkAndSetupExchangeRates,
};
