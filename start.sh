#!/bin/bash

# ================================================================
#                  VALEO - INTELLIGENT CAMERA SYSTEM
#                  Project Startup Script
#
#  Creators:
#       - Iyed Tababi
#       - [Creator 2]
#       - [Creator 3]
#
# ================================================================


# ================= COLORS =================

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
WHITE="\033[1;37m"
NC="\033[0m"


# ================= HEADER =================

clear

echo -e "${CYAN}"
echo "======================================================"
echo "                                                      "
echo "              VALEO INTELLIGENT CAMERA                "
echo "              AI Vision Control System                "
echo "                                                      "
echo "======================================================"
echo -e "${WHITE}"
echo " Project : Industrial Camera Detection"
echo " Platform: Node.js + Python AI"
echo ""
echo " Creators:"
echo "    - Iyed Tababi"
echo "    - [Creator 2]"
echo "    - [Creator 3]"
echo -e "${CYAN}"
echo "======================================================"
echo -e "${NC}"


# ================= ROBOfLOW KEY =================

export VALEO_ROBOFLOW_API_KEY="dQudu2taTYXhZN8DmqZo"
export VALEO_ROBOFLOW_SECOND_API_KEY="KeCJQZgmePtugUhbMNTC"


# =================================================
# 1 - NODE JS CHECK
# =================================================

echo -e "${YELLOW}[1/6] Checking Node.js...${NC}"

if ! command -v node >/dev/null 2>&1
then
    echo -e "${RED}Node.js not installed${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js detected : $(node -v)${NC}"



# =================================================
# 2 - NPM CHECK
# =================================================

echo -e "${YELLOW}[2/6] Checking npm...${NC}"

if ! command -v npm >/dev/null 2>&1
then
    echo -e "${RED}npm not installed${NC}"
    exit 1
fi

echo -e "${GREEN}npm detected : $(npm -v)${NC}"



# =================================================
# 3 - SERVER DIRECTORY
# =================================================

echo -e "${YELLOW}[3/6] Searching server directory...${NC}"


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SERVER_DIR="$SCRIPT_DIR/server"


if [ ! -d "$SERVER_DIR" ]
then
    echo -e "${RED}Server directory not found${NC}"
    exit 1
fi


cd "$SERVER_DIR"

echo -e "${GREEN}Server directory ready${NC}"



# =================================================
# 4 - NODE DEPENDENCIES
# =================================================


echo -e "${YELLOW}[4/6] Checking Node dependencies...${NC}"


if [ ! -d "node_modules" ]
then

    echo "Installing npm packages..."

    npm install

    if [ $? -ne 0 ]
    then
        echo -e "${RED}npm installation failed${NC}"
        exit 1
    fi

fi


echo -e "${GREEN}Node dependencies ready${NC}"



# =================================================
# 5 - PYTHON AI ENVIRONMENT
# =================================================


echo -e "${YELLOW}[5/6] Preparing AI environment...${NC}"


if ! command -v python3 >/dev/null 2>&1
then
    echo -e "${RED}Python3 missing${NC}"
    exit 1
fi



if ! python3 -m venv --help >/dev/null 2>&1
then

    echo "Installing python virtual environment..."

    sudo apt update
    sudo apt install -y python3-venv

fi



VENV="$SCRIPT_DIR/.venv"


if [ ! -d "$VENV" ]
then

    echo "Creating Python environment..."

    python3 -m venv "$VENV"

fi



source "$VENV/bin/activate"



python -m pip install --upgrade pip >/dev/null



if python -c "import inference_sdk" >/dev/null 2>&1
then

    echo -e "${GREEN}Inference SDK already installed${NC}"

else

    echo "Installing Roboflow inference SDK..."

    pip install -U inference-sdk


    if [ $? -ne 0 ]
    then

        echo -e "${RED}Inference SDK installation failed${NC}"

        deactivate
        exit 1

    fi

fi


echo -e "${GREEN}AI environment ready${NC}"



# =================================================
# 6 - START SERVER
# =================================================


echo ""
echo -e "${CYAN}"
echo "======================================================"
echo "              STARTING VALEO SERVER                  "
echo "======================================================"
echo -e "${NC}"

echo -e "${WHITE}"
echo " URL       : http://localhost:3000"
echo " Account   : ADMIN-001"
echo " Password  : admin123"
echo ""
echo " Roboflow AI : Connected"
echo ""
echo " Press CTRL+C to stop server"
echo -e "${NC}"


echo ""


node server.js



deactivate