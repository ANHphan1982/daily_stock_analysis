# -*- coding: utf-8 -*-
"""Add Vietnamese stocks to stocks.index.json files."""
import json

VN_STOCKS = [
    # Blue chips HOSE
    ["VN:VIC", "VN:VIC", "Vingroup", None, None, ["Vingroup", "VIC"], "VN", "stock", True, 100],
    ["VN:VHM", "VN:VHM", "Vinhomes", None, None, ["Vinhomes", "VHM"], "VN", "stock", True, 99],
    ["VN:VCB", "VN:VCB", "Vietcombank", None, None, ["Vietcombank", "VCB"], "VN", "stock", True, 99],
    ["VN:BID", "VN:BID", "BIDV", None, None, ["BIDV", "BID"], "VN", "stock", True, 98],
    ["VN:CTG", "VN:CTG", "Vietinbank", None, None, ["Vietinbank", "CTG"], "VN", "stock", True, 97],
    ["VN:HPG", "VN:HPG", "Hoa Phat Group", None, None, ["Hoa Phat", "HPG"], "VN", "stock", True, 97],
    ["VN:FPT", "VN:FPT", "FPT Corp", None, None, ["FPT"], "VN", "stock", True, 96],
    ["VN:VNM", "VN:VNM", "Vinamilk", None, None, ["Vinamilk", "VNM"], "VN", "stock", True, 96],
    ["VN:MWG", "VN:MWG", "Mobile World", None, None, ["Mobile World", "The Gioi Di Dong", "MWG"], "VN", "stock", True, 95],
    ["VN:TCB", "VN:TCB", "Techcombank", None, None, ["Techcombank", "TCB"], "VN", "stock", True, 95],
    ["VN:GAS", "VN:GAS", "PV Gas", None, None, ["PV Gas", "PetroVietnam Gas", "GAS"], "VN", "stock", True, 94],
    ["VN:MSN", "VN:MSN", "Masan Group", None, None, ["Masan", "MSN"], "VN", "stock", True, 93],
    ["VN:VPB", "VN:VPB", "VPBank", None, None, ["VPBank", "VPB"], "VN", "stock", True, 93],
    ["VN:MBB", "VN:MBB", "MB Bank", None, None, ["MB Bank", "MBB"], "VN", "stock", True, 92],
    ["VN:ACB", "VN:ACB", "ACB Bank", None, None, ["ACB", "Asia Commercial Bank"], "VN", "stock", True, 92],
    ["VN:STB", "VN:STB", "Sacombank", None, None, ["Sacombank", "STB"], "VN", "stock", True, 91],
    ["VN:VRE", "VN:VRE", "Vincom Retail", None, None, ["Vincom Retail", "VRE"], "VN", "stock", True, 90],
    ["VN:SAB", "VN:SAB", "Sabeco", None, None, ["Sabeco", "Bia Sai Gon", "SAB"], "VN", "stock", True, 90],
    ["VN:PLX", "VN:PLX", "Petrolimex", None, None, ["Petrolimex", "PLX"], "VN", "stock", True, 89],
    ["VN:SSI", "VN:SSI", "SSI Securities", None, None, ["SSI"], "VN", "stock", True, 89],
    ["VN:HDB", "VN:HDB", "HDBank", None, None, ["HDBank", "HDB"], "VN", "stock", True, 88],
    ["VN:VIB", "VN:VIB", "VIB Bank", None, None, ["VIB", "Vietnam International Bank"], "VN", "stock", True, 87],
    ["VN:PNJ", "VN:PNJ", "Phu Nhuan Jewelry", None, None, ["PNJ", "Phu Nhuan"], "VN", "stock", True, 87],
    ["VN:EIB", "VN:EIB", "Eximbank", None, None, ["Eximbank", "EIB"], "VN", "stock", True, 86],
    ["VN:TPB", "VN:TPB", "TPBank", None, None, ["TPBank", "TPB"], "VN", "stock", True, 86],
    ["VN:SHB", "VN:SHB", "SHBank", None, None, ["SHBank", "SHB"], "VN", "stock", True, 85],
    ["VN:OCB", "VN:OCB", "Orient Commercial Bank", None, None, ["OCB", "Orient Commercial"], "VN", "stock", True, 84],
    ["VN:NVL", "VN:NVL", "Novaland", None, None, ["Novaland", "NVL"], "VN", "stock", True, 84],
    ["VN:REE", "VN:REE", "REE Corp", None, None, ["REE"], "VN", "stock", True, 83],
    ["VN:VJC", "VN:VJC", "Vietjet Air", None, None, ["Vietjet", "Vietjet Air", "VJC"], "VN", "stock", True, 83],
    ["VN:BVH", "VN:BVH", "Bao Viet Holdings", None, None, ["Bao Viet", "BVH"], "VN", "stock", True, 82],
    ["VN:GVR", "VN:GVR", "VN Rubber Group", None, None, ["VRG", "Cao su Viet Nam", "GVR"], "VN", "stock", True, 81],
    ["VN:LPB", "VN:LPB", "LienVietPostBank", None, None, ["LienVietPostBank", "LPB"], "VN", "stock", True, 81],
    ["VN:KDH", "VN:KDH", "Khang Dien", None, None, ["Khang Dien", "KDH"], "VN", "stock", True, 80],
    ["VN:PDR", "VN:PDR", "Phat Dat Real Estate", None, None, ["Phat Dat", "PDR"], "VN", "stock", True, 80],
    ["VN:DPM", "VN:DPM", "PV Fertilizer", None, None, ["PV Fertilizer", "Dam Phu My", "DPM"], "VN", "stock", True, 79],
    ["VN:DCM", "VN:DCM", "PV Ca Mau Fertilizer", None, None, ["DCM", "Dam Ca Mau", "PV Ca Mau"], "VN", "stock", True, 79],
    ["VN:HVN", "VN:HVN", "Vietnam Airlines", None, None, ["Vietnam Airlines", "HVN"], "VN", "stock", True, 78],
    ["VN:VND", "VN:VND", "VNDIRECT Securities", None, None, ["VNDIRECT", "VND"], "VN", "stock", True, 77],
    ["VN:VCI", "VN:VCI", "Viet Capital Securities", None, None, ["Viet Capital", "VCI"], "VN", "stock", True, 77],
    ["VN:BSR", "VN:BSR", "Binh Son Refinery", None, None, ["Binh Son", "BSR"], "VN", "stock", True, 76],
    ["VN:GMD", "VN:GMD", "Gemadept", None, None, ["Gemadept", "GMD"], "VN", "stock", True, 75],
    ["VN:VHC", "VN:VHC", "Vinh Hoan Corp", None, None, ["Vinh Hoan", "VHC"], "VN", "stock", True, 75],
    ["VN:PVD", "VN:PVD", "PV Drilling", None, None, ["PVD", "PV Drilling", "Khoan Dau Khi"], "VN", "stock", True, 74],
    ["VN:PVS", "VN:PVS", "PV Technical Services", None, None, ["PVS", "PV Tech", "PVTS"], "VN", "stock", True, 74],
    ["VN:KDC", "VN:KDC", "Kido Group", None, None, ["Kido", "KDC"], "VN", "stock", True, 73],
    ["VN:VGC", "VN:VGC", "Viglacera", None, None, ["Viglacera", "VGC"], "VN", "stock", True, 72],
    ["VN:KBC", "VN:KBC", "Kinh Bac City", None, None, ["Kinh Bac", "KBC"], "VN", "stock", True, 72],
    ["VN:HAG", "VN:HAG", "Hoang Anh Gia Lai", None, None, ["HAGL", "Hoang Anh Gia Lai", "HAG"], "VN", "stock", True, 71],
    ["VN:DBC", "VN:DBC", "Dabaco Group", None, None, ["Dabaco", "DBC"], "VN", "stock", True, 70],
    ["VN:SSB", "VN:SSB", "SeABank", None, None, ["SeABank", "SSB"], "VN", "stock", True, 70],
    ["VN:VCG", "VN:VCG", "Vinaconex", None, None, ["Vinaconex", "VCG"], "VN", "stock", True, 69],
    ["VN:NLG", "VN:NLG", "Nam Long Group", None, None, ["Nam Long", "NLG"], "VN", "stock", True, 69],
    ["VN:PC1", "VN:PC1", "Power Construction 1", None, None, ["PC1", "Power Construction"], "VN", "stock", True, 68],
    ["VN:TLG", "VN:TLG", "Thien Long Group", None, None, ["Thien Long", "TLG"], "VN", "stock", True, 67],
    ["VN:PHR", "VN:PHR", "Phuoc Hoa Rubber", None, None, ["Phuoc Hoa", "PHR"], "VN", "stock", True, 66],
    ["VN:IMP", "VN:IMP", "Imexpharm", None, None, ["Imexpharm", "IMP"], "VN", "stock", True, 65],
    ["VN:FRT", "VN:FRT", "FPT Retail", None, None, ["FPT Retail", "FRT"], "VN", "stock", True, 65],
    ["VN:QNS", "VN:QNS", "Quang Ngai Sugar", None, None, ["Quang Ngai Sugar", "Duong Quang Ngai", "QNS"], "VN", "stock", True, 64],
    ["VN:MPC", "VN:MPC", "Minh Phu Seafood", None, None, ["Minh Phu", "MPC"], "VN", "stock", True, 63],
    ["VN:VSC", "VN:VSC", "Vietnam Container Shipping", None, None, ["VSC", "Vietnam Container"], "VN", "stock", True, 62],
    ["VN:PAN", "VN:PAN", "PAN Group", None, None, ["PAN", "PAN Group"], "VN", "stock", True, 61],
    ["VN:TCH", "VN:TCH", "Hai Phat Invest", None, None, ["Hai Phat", "TCH"], "VN", "stock", True, 60],
    ["VN:AGG", "VN:AGG", "An Gia Real Estate", None, None, ["An Gia", "AGG"], "VN", "stock", True, 59],
    ["VN:IJC", "VN:IJC", "Becamex IJC", None, None, ["Becamex IJC", "IJC"], "VN", "stock", True, 58],
    ["VN:BFC", "VN:BFC", "Binh Dien Fertilizer", None, None, ["Binh Dien", "BFC"], "VN", "stock", True, 57],
    ["VN:HDC", "VN:HDC", "Hoa Binh Development", None, None, ["Hoa Binh Dev", "HDC"], "VN", "stock", True, 56],
    ["VN:HT1", "VN:HT1", "Ha Tien 1 Cement", None, None, ["Ha Tien 1", "HT1"], "VN", "stock", True, 55],
    ["VN:NAB", "VN:NAB", "Nam A Bank", None, None, ["Nam A Bank", "NAB"], "VN", "stock", True, 55],
    ["VN:NKG", "VN:NKG", "Nam Kim Steel", None, None, ["Nam Kim", "NKG"], "VN", "stock", True, 54],
    ["VN:PVT", "VN:PVT", "PV Transportation", None, None, ["PV Transport", "PVT"], "VN", "stock", True, 54],
    ["VN:IDC", "VN:IDC", "IDICO Corp", None, None, ["IDICO", "IDC"], "VN", "stock", True, 53],
    # HNX
    ["VN:SHN", "VN:SHN", "SHN Securities", None, None, ["SHN"], "VN", "stock", True, 52],
    ["VN:HUT", "VN:HUT", "Tasco", None, None, ["Tasco", "HUT"], "VN", "stock", True, 51],
    ["VN:SHS", "VN:SHS", "Saigon Hanoi Securities", None, None, ["SHS", "SHS Securities"], "VN", "stock", True, 50],
    # UPCOM
    ["VN:ACV", "VN:ACV", "Airports Corp Vietnam", None, None, ["ACV", "Vietnam Airports"], "VN", "stock", True, 58],
    ["VN:MCH", "VN:MCH", "Masan Consumer", None, None, ["Masan Consumer", "MCH"], "VN", "stock", True, 57],
    ["VN:VEA", "VN:VEA", "Vietnam Engine Agriculture", None, None, ["VEA", "VEAM"], "VN", "stock", True, 56],
    # VN Indices
    ["VNINDEX", "VNINDEX", "VN-Index", None, None, ["VN-Index", "VNINDEX"], "VN", "index", True, 100],
    ["VN30", "VN30", "VN30 Index", None, None, ["VN30", "VN-30"], "VN", "index", True, 95],
    ["HNX", "HNX", "HNX Index", None, None, ["HNX", "HNX-Index"], "VN", "index", True, 85],
    ["UPCOM", "UPCOM", "UPCOM Index", None, None, ["UPCOM"], "VN", "index", True, 75],
]

for path in [
    "d:/daily_stock_analysis_v2/static/stocks.index.json",
    "d:/daily_stock_analysis_v2/apps/dsa-web/public/stocks.index.json",
]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    existing = {item[0] for item in data if isinstance(item, list)}
    added = 0
    for s in VN_STOCKS:
        if s[0] not in existing:
            data.append(s)
            added += 1

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"{path}: added {added} VN stocks, total {len(data)}")
