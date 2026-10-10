def _tlv(tag, value):
    return f"{tag}{len(value):02d}{value}"


def _crc16(data: str) -> str:            # CRC-16/CCITT-FALSE
    crc = 0xFFFF
    for b in data.encode():
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else crc << 1
            crc &= 0xFFFF
    return f"{crc:04X}"


def vietqr_payload(bin_code, account_no, amount, content):
    bank = _tlv("00", bin_code) + _tlv("01", account_no)
    merchant = _tlv("00", "A000000727") + _tlv("01", bank) + _tlv("02", "QRIBFTTA")
    body = (_tlv("00", "01") + _tlv("01", "12") + _tlv("38", merchant) + _tlv("53", "704")
            + _tlv("54", str(amount)) + _tlv("58", "VN") + _tlv("62", _tlv("08", content)) + "6304")
    return body + _crc16(body)