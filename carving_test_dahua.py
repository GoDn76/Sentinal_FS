import mmap
import struct
import hashlib

def carve_dhav_from_disk(disk_image_path, output_path):
    MAGIC_BYTE = b'DHAV'
    hasher = hashlib.sha256()
    recovered_chunks = []
    
    print(f"Scanning {disk_image_path} for proprietary Dahua (DHAV) headers...")
    
    with open(disk_image_path, "rb") as f:
        with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            pos = 0
            while True:
                # 1. Search for the DHAV magic signature
                pos = mm.find(MAGIC_BYTE, pos)
                if pos == -1:
                    break
                
                # 2. Extract the proprietary frame length
                # The total frame length is an unsigned int (I) stored at byte offset 12-15
                if pos + 16 <= len(mm):
                    header_segment = mm[pos:pos+16]
                    frame_length = struct.unpack('<I', header_segment[12:16])[0]
                    
                    # Basic sanity check: avoid absurdly large or small chunks
                    if 100 < frame_length < 5000000 and pos + frame_length <= len(mm):
                        
                        # 3. Carve the exact chunk directly out of the unallocated space
                        chunk = mm[pos : pos + frame_length]
                        recovered_chunks.append(chunk)
                        hasher.update(chunk)
                        
                        # Jump to the end of this chunk to find the next one
                        pos += frame_length
                        continue
                
                pos += 4 # Move forward if validation failed

    print(f"Carving complete. Recovered {len(recovered_chunks)} DHAV frames.")
    
    with open(output_path, "wb") as out:
        for chunk in recovered_chunks:
            out.write(chunk)
            
    print(f"Saved to {output_path}")
    print(f"Section 63B Evidence Hash (SHA-256): {hasher.hexdigest()}")

# Run the carver
carve_dhav_from_disk("fake_disk.raw", "recovered_dahua.dav")