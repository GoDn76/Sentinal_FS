import os
import struct

def split_nal_units(data: bytes):
    """Split an Annex B H.264 stream into a list of NAL units."""
    units = []
    start = None
    i = 0
    n = len(data)
    while i < n - 3:
        if data[i:i+3] == b'\x00\x00\x01':
            code_len = 3
        elif data[i:i+4] == b'\x00\x00\x00\x01':
            code_len = 4
        else:
            i += 1
            continue
        if start is not None:
            units.append(data[start:i])
        start = i
        i += code_len
    if start is not None:
        units.append(data[start:])
    return units

def group_into_frames(nal_units):
    """Group NAL units into individual video frames."""
    frames = []
    current = []
    for u in nal_units:
        nal_type = u[3] & 0x1F if u[2] == 1 else u[4] & 0x1F
        current.append(u)
        if nal_type in (1, 5):  # slice NAL ends a frame
            frames.append(b''.join(current))
            current = []
    if current:
        frames.append(b''.join(current))
    return frames

def pack_date(year, month, day, hour, minute, sec):
    return ((year - 2000) << 26) | (month << 22) | (day << 17) | (hour << 12) | (minute << 6) | sec

def build_chunk(payload: bytes, frame_number: int, is_keyframe: bool):
    """Wraps a standard H.264 frame in a proprietary Dahua DHAV header."""
    chunk_type = 0xfd if is_keyframe else 0xfc
    ext = struct.pack('<B3xHH', 0x82, 320, 240)
    ext += struct.pack('<BBBB', 0x81, 0x00, 0x08, 25)
    ext_length = len(ext)
    
    # 32 bytes for the main header + extension length + payload
    frame_length = len(payload) + 32 + ext_length
    date = pack_date(2026, 8, 29, 12, 0, 0)
    
    header = struct.pack('<4sBBBBIII', b'DHAV', chunk_type, 0x00, 0x00, 0x00, frame_number, frame_length, date)
    header += struct.pack('<HBB', 0, ext_length, 0x00)
    return header + ext + payload

# 1. Read the raw H.264
print("Reading output.h264...")
with open('output.h264', 'rb') as f:
    raw = f.read()

# 2. Process Data
nal_units = split_nal_units(raw)
frames = group_into_frames(nal_units)
print(f"Grouped into {len(frames)} frames")

# 3. Build DHAV chunks
output = b''
for i, frame in enumerate(frames):
    is_key = (i == 0)
    output += build_chunk(frame, frame_number=i, is_keyframe=is_key)

# 4. Save the pure .dav file (for FFmpeg testing)
with open('fake_test.dav', 'wb') as f:
    f.write(output)
print(f"Wrote fake_test.dav ({len(output)} bytes)")

# 5. Bury it inside a fake raw disk image
disk_size = 50 * 1024 * 1024  # 50 MB fake disk
with open('fake_disk.raw', 'wb') as disk:
    disk.write(os.urandom(disk_size)) 

with open('fake_disk.raw', 'r+b') as disk:
    disk.seek(5 * 1024 * 1024)  # Bury it 5MB deep
    disk.write(output)
print("Embedded DHAV chunks into fake_disk.raw (No Index) — Ready for carving test.")